import type { Pool } from 'mysql2/promise';
import { enTransaccion, enTransaccionIdempotente } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { aIso } from '../../../platform/tiempo/fechas.js';
import { crearServicioDeDispositivos } from '../../dispositivos/contracts.js';
import { crearServicioDeLimites } from '../../limites/contracts.js';
import { crearServicioDeOrganizacion } from '../../organizacion/contracts.js';
import { crearServicioDeUsuarios } from '../../seguridad/contracts.js';
import { crearServicioDeSuscripciones } from '../../suscripciones/contracts.js';
import {
  decidirApertura,
  estadoVisible,
  MOTIVO_ORDENADA,
  VIGENCIA_DE_ORDEN_MS,
  type EstadoDeOrden,
  type MotivoManualRechazado,
  type RechazoDeApertura,
} from '../domain/apertura-manual.js';
import { hashDeClave } from '../domain/idempotencia.js';
import { finDelDiaLocal, inicioDelDiaLocal } from '../domain/vencimiento.js';
import { RepositorioDeOrdenesDeApertura, type OrdenFila } from '../ordenes-repository.js';
import { RepositorioDeLecturas } from '../repository.js';

export interface DatosDeApertura {
  readonly puertaId: string;
  /** `Idempotency-Key` de la app (obligatoria) y el secreto con que se hashea (`QR_IDEMPOTENCIA_CLAVE`). */
  readonly idempotencia: { readonly clave: string; readonly secreto: string };
  /** Dónde dejar rastro de lo que no debe tumbar la respuesta (nunca lleva clave, PIN ni token). */
  readonly log?: { warn(objeto: object, mensaje: string): void };
}

export interface OrdenDeApertura {
  readonly orden_id: string;
  readonly estado: EstadoDeOrden;
  readonly vence_at: string;
  /** Solo en un reintento idempotente: es la orden que ya existía, no se creó nada. La ruta lo manda en una cabecera. */
  readonly repetida?: true;
}

const esDuplicadoDe = (error: unknown, indice: string): boolean =>
  (error as { code?: string } | null)?.code === 'ER_DUP_ENTRY' &&
  String((error as { message?: unknown }).message).includes(indice);

const aError = (r: RechazoDeApertura): ErrorDeDominio =>
  new ErrorDeDominio(r.codigo, r.status, r.extra);

/**
 * Pide abrir una puerta desde la app (ADR 0035): un QR sin imagen, con la misma validación y otro canal. Si todo
 * pasa, crea la orden de abrir que la primera placa de la puerta tomará con su petición larga; la placa no decide
 * nada, obedece una orden positiva del servidor (invariante 2). La petición no lleva sentido.
 *
 * Valida, en este orden (`decidirApertura`): usuario activo (no restringido, suspendido ni eliminado; el estado se
 * relee y bloquea DENTRO de la transacción, como al generar un QR), suscripción vigente, puerta con la apertura
 * manual encendida, al menos una placa en servicio y una en línea, ninguna orden viva en la puerta, enfriamiento
 * entre órdenes del mismo usuario y tope diario (ADR 0030; estos topes limitan PEDIR abrir, nunca validar un QR).
 *
 * Una puerta que no es de la cuenta (o no existe, o está inactiva) es 404 `puerta.no_encontrada` y no deja
 * lectura: no hay puerta propia sobre la cual registrar. TODO lo demás, aceptado o rechazado, deja una fila en
 * `lecturas` (`metodo = 'manual'`, `usuario_id`, sin dispositivo; invariante 4) en la MISMA transacción que la
 * orden: o quedan las dos o ninguna. Los rechazos se registran y recién entonces se lanza el error.
 *
 * Idempotencia (ADR 0035 §7): la `Idempotency-Key` se guarda hasheada en `ordenes_apertura.clave_idempotencia`
 * (índice único por cuenta, usuario y clave), no en `claves_idempotencia`: esa tabla guarda una respuesta JSON de
 * 24 h para operaciones que devuelven un secreto derivado (el token del QR); acá la «respuesta» ES la orden, que
 * ya está en la base con su propio estado, así que la clave vive junto a ella y se crea en la misma transacción.
 * Un reintento con la misma clave devuelve la misma orden (con su estado actual), sin otra lectura ni otra orden;
 * la misma clave sobre otra puerta es `idempotencia.conflicto`. Cada pulsación nueva de la app lleva clave nueva.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  datos: DatosDeApertura,
  ahora: Date = new Date(),
  señal?: AbortSignal,
): Promise<OrdenDeApertura> {
  const ordenes = new RepositorioDeOrdenesDeApertura(pool);
  const lecturas = new RepositorioDeLecturas(pool);
  const claveHash = hashDeClave(
    datos.idempotencia.secreto,
    datos.idempotencia.clave,
    'manual-idempotencia-clave-v1',
  );

  const repetir = (previa: OrdenFila): OrdenDeApertura => {
    if (previa.puerta_id !== datos.puertaId)
      throw new ErrorDeDominio('idempotencia.conflicto', 422);
    return { ...presentar(previa, ahora), repetida: true };
  };

  // Un reintento no gasta nada: se contesta con la orden guardada antes de mirar nada más.
  const previa = await ordenes.buscarPorClave(principal.usuarioId, claveHash);
  if (previa !== null) return repetir(previa);

  const [puerta] = await crearServicioDeOrganizacion(pool).buscarPuertas([datos.puertaId]);
  if (puerta?.activa !== true) throw new ErrorDeDominio('puerta.no_encontrada', 404);

  const [suscripcion, placas, topes] = await Promise.all([
    crearServicioDeSuscripciones(pool).obtenerVigente(ahora),
    crearServicioDeDispositivos(pool).placasPorPuerta([puerta.id], ahora),
    crearServicioDeLimites(pool).topesDeAperturaManual(principal.usuarioId),
  ]);
  const usuarios = crearServicioDeUsuarios(pool);
  const inicioDelDia = inicioDelDiaLocal(ahora, puerta.zonaHoraria);
  const finDelDia = finDelDiaLocal(ahora, puerta.zonaHoraria);

  type Resultado =
    | { readonly tipo: 'orden'; readonly fila: OrdenFila; readonly repetida: boolean }
    | { readonly tipo: 'rechazo'; readonly rechazo: RechazoDeApertura };

  /** Deja la lectura del rechazo en `tx` y lo devuelve para lanzarlo tras el COMMIT. */
  const rechazar = async (
    tx: Parameters<typeof lecturas.registrarManual>[0],
    rechazo: RechazoDeApertura,
  ): Promise<Resultado> => {
    await lecturas.registrarManual(tx, {
      puertaId: puerta.id,
      usuarioId: principal.usuarioId,
      resultado: 'rechazado',
      motivoCode: rechazo.motivo,
      ocurridoAt: ahora,
    });
    return { tipo: 'rechazo', rechazo };
  };

  let resultado: Resultado;
  try {
    resultado = await enTransaccionIdempotente(
      pool,
      async (tx): Promise<Resultado> => {
        // Primero el estado, bloqueado: desde acá nadie puede restringir ni suspender a este usuario hasta que la
        // transacción termine, y dos peticiones suyas se esperan (los conteos de abajo ven la una a la otra).
        const efectivo = await usuarios.estadoEfectivoBloqueando(tx, principal.usuarioId);

        // Una petición suya con la misma clave que esperaba el bloqueo ya confirmó.
        const yaCreada = await ordenes.buscarPorClave(principal.usuarioId, claveHash, tx);
        if (yaCreada !== null) return { tipo: 'orden', fila: yaCreada, repetida: true };

        let viva = await ordenes.buscarVivaDeLaPuerta(puerta.id, tx, true);
        // Una orden que nunca se entregó y ya venció no impide pedir otra: se marca vencida acá mismo (no hay
        // placa a la que preguntarle, así que no queda nada que confirmar). Una `entregada` vencida la resuelve el
        // proceso periódico, que además deja la constancia `sin_respuesta`.
        if (viva?.estado === 'pendiente' && viva.vence_at <= ahora) {
          await ordenes.vencer(tx, viva.id, ahora);
          viva = null;
        }

        const rechazo = decidirApertura({
          usuario: efectivo,
          suscripcionVigente: suscripcion !== null,
          puertaHabilitada: puerta.aperturaManual,
          placas: placas.get(puerta.id) ?? { enServicio: 0, enLinea: 0 },
          hayOrdenViva: viva !== null,
          ultimaOrdenDelUsuarioAt: await ordenes.ultimaCreadaDe(principal.usuarioId, puerta.id, tx),
          ordenesDeHoy: await ordenes.contarDesde(principal.usuarioId, inicioDelDia, tx),
          topes,
          ahora,
          finDelDia,
        });
        if (rechazo !== null) return rechazar(tx, rechazo);

        const lecturaId = await lecturas.registrarManual(tx, {
          puertaId: puerta.id,
          usuarioId: principal.usuarioId,
          resultado: 'permitido',
          motivoCode: MOTIVO_ORDENADA,
          ocurridoAt: ahora,
        });
        const ordenId = await ordenes.crear(tx, {
          puertaId: puerta.id,
          usuarioId: principal.usuarioId,
          lecturaId,
          claveIdempotencia: claveHash,
          creadaAt: ahora,
          venceAt: new Date(ahora.getTime() + VIGENCIA_DE_ORDEN_MS),
        });
        const fila = await ordenes.buscarPorId(ordenId, tx);
        if (fila === null) throw new Error('la orden recién creada no se encuentra');
        return { tipo: 'orden', fila, repetida: false };
      },
      { ...(señal === undefined ? {} : { señal }) },
    );
  } catch (error: unknown) {
    // Dos peticiones a la vez sobre la misma puerta: el índice único dejó pasar solo a una. La otra ya se deshizo
    // y su rechazo se registra aparte (invariante 4) antes de contestar.
    if (esDuplicadoDe(error, 'uq_ordenes_apertura_vigente')) {
      const rechazo: RechazoDeApertura = {
        motivo: 'manual.orden_en_curso',
        codigo: 'manual.orden_en_curso',
        status: 409,
        extra: {},
      };
      await registrarRechazoAparte(
        pool,
        lecturas,
        principal,
        puerta.id,
        rechazo.motivo,
        ahora,
        datos,
      );
      throw aError(rechazo);
    }
    // La misma clave llegó dos veces a la vez y la otra ganó: es el reintento, se devuelve su orden.
    if (esDuplicadoDe(error, 'uq_ordenes_apertura_clave')) {
      const ganadora = await ordenes.buscarPorClave(principal.usuarioId, claveHash);
      if (ganadora !== null) return repetir(ganadora);
    }
    throw error;
  }

  if (resultado.tipo === 'rechazo') throw aError(resultado.rechazo);
  return resultado.repetida ? repetir(resultado.fila) : presentar(resultado.fila, ahora);
}

function presentar(fila: OrdenFila, ahora: Date): OrdenDeApertura {
  return {
    orden_id: fila.id,
    estado: estadoVisible(fila.estado, fila.vence_at, ahora),
    vence_at: aIso(fila.vence_at),
  };
}

/**
 * Registra en su propia transacción un rechazo cuya transacción original se deshizo. Si registrarlo falla, el 409 al
 * usuario sigue siendo la respuesta (el rastro se pierde, y queda un aviso en el log sin datos del usuario).
 */
async function registrarRechazoAparte(
  pool: Pool,
  lecturas: RepositorioDeLecturas,
  principal: PrincipalUsuario,
  puertaId: string,
  motivo: MotivoManualRechazado,
  ahora: Date,
  datos: DatosDeApertura,
): Promise<void> {
  try {
    await enTransaccion(pool, (tx) =>
      lecturas.registrarManual(tx, {
        puertaId,
        usuarioId: principal.usuarioId,
        resultado: 'rechazado',
        motivoCode: motivo,
        ocurridoAt: ahora,
      }),
    );
  } catch (falla: unknown) {
    datos.log?.warn(
      { evento: 'manual.rechazo_sin_registrar', codigo: (falla as { code?: string }).code },
      'no se pudo registrar el rechazo de la apertura manual',
    );
  }
}
