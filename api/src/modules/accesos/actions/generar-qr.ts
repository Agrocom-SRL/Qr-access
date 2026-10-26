import type { Pool } from 'mysql2/promise';
import {
  enTransaccion,
  enTransaccionIdempotente,
  type Transaccion,
} from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { aIso } from '../../../platform/tiempo/fechas.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import {
  crearServicioDeLimites,
  type RechazoDeGeneracion,
  type ServicioDeLimites,
  type TopesDeGeneracion,
} from '../../limites/contracts.js';
import { crearServicioDeOrganizacion } from '../../organizacion/contracts.js';
import { crearServicioDeUsuarios, type EstadoEfectivo } from '../../seguridad/contracts.js';
import { crearServicioDeSuscripciones } from '../../suscripciones/contracts.js';
import { generarTokenQr, hashDeToken, textoDeQr } from '../domain/token-qr.js';
import {
  diaLocal,
  finDelDiaLocal,
  inicioDelDiaLocal,
  inicioDelMesLocal,
  vencimientoMaximo,
  vencimientoPorDefecto,
  ZONA_DE_LOS_TOPES,
} from '../domain/vencimiento.js';
import { RepositorioDePuertasDeQr, RepositorioDeQr } from '../repository.js';

export interface DatosDeGeneracion {
  readonly puertaIds: readonly string[];
  /** Una vigencia hasta el máximo del plan; sin ella, el fin del día local. */
  readonly venceAt: Date | null;
  readonly etiqueta: string | null;
  /** Es el QR de "Mi QR de acceso": solo uno activo por usuario y fuera de "Mis QR". */
  readonly propio?: boolean;
  /**
   * Solo con `propio`: quiere otro QR aunque el vigente siga sin usarse y sea para las mismas puertas (la app
   * ya no tiene su token, ADR 0030 §2.1.3). El anterior queda anulado y cuenta como reemplazo sin uso.
   */
  readonly reemplazar?: boolean;
  /** Dónde dejar rastro de lo que no debe tumbar la respuesta (nunca lleva PIN, token ni texto de QR). */
  readonly log?: { warn(objeto: object, mensaje: string): void };
}

export interface QrGenerado {
  id: string;
  /**
   * El único momento en que existe el token en claro (ADR 0008): después solo queda su hash. `null` cuando
   * `reutilizado`: el servidor no lo guarda, la app lo muestra desde su copia local (ADR 0030 §2.1.2).
   */
  texto: string | null;
  /** `true` = no se generó nada: ya había un QR propio vigente sin usar para esas puertas (ADR 0030 §2.1). */
  reutilizado: boolean;
  vence_at: string;
  etiqueta: string | null;
  puertas: { id: string; nombre: string }[];
}

type CodigoDeTope = RechazoDeGeneracion['tipo'];

/** Un rechazo por tope de generación: lleva lo que hace falta para dejarlo registrado (ADR 0030 §7). */
class RechazoPorTope extends ErrorDeDominio {
  constructor(
    readonly tipo: CodigoDeTope,
    readonly actual: number,
    readonly tope: number,
    reintentarEnSegundos: number | null,
  ) {
    super(tipo, 429, {
      tope,
      ...(reintentarEnSegundos === null ? {} : { reintentar_en_segundos: reintentarEnSegundos }),
    });
  }
}

const segundosHasta = (instante: Date, ahora: Date): number =>
  Math.max(1, Math.ceil((instante.getTime() - ahora.getTime()) / 1000));

/** Qué responde la generación a quien ya no está activo (lo vio la transacción, no el token de acceso). */
function errorPorEstado(efectivo: EstadoEfectivo): ErrorDeDominio {
  if (efectivo.estado === 'restringido') {
    return new ErrorDeDominio('qr.generacion_restringida', 403, { origen: efectivo.origen });
  }
  return new ErrorDeDominio(
    efectivo.estado === 'suspendido' && efectivo.origen === 'cuenta'
      ? 'qr.cuenta_suspendida'
      : 'qr.generador_suspendido',
    403,
  );
}

const mismoConjunto = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id) => b.includes(id));

/**
 * Genera un QR de un solo uso para una o más puertas de la cuenta (HU-11). Rechaza si la
 * suscripción no está vigente, si alguna puerta no es de la cuenta o si la vigencia pedida
 * pasa el máximo (el límite del plan o, sin él, 7 días); sin vigencia pedida, vence al fin del día
 * local del sitio.
 *
 * Un restringido (él, un superior o su cuenta, ADR 0031 §0) no genera: `qr.generacion_restringida`.
 * Es lo primero que se mira; lo ya generado por él sigue abriendo hasta vencer. El estado se vuelve a
 * leer, y a bloquear, dentro de la transacción que inserta: una suspensión que se confirma entre la
 * autenticación y el insert no puede dejar un QR vivo (ADR 0031 §1).
 *
 * Los topes (ADR 0030 §2) solo limitan GENERAR; validar un QR no pasa por acá y nunca se limita:
 * - más puertas que el máximo por QR: 422 `qr.limite_puertas` (ADR 0031 §9);
 * - QR propio vigente y sin usar para las mismas puertas: no se genera nada, `reutilizado: true` (§2.1);
 * - reemplazarlo sin uso (otras puertas o `reemplazar`): máximo por día y con espera entre uno y otro,
 *   `qr.limite_propios_sin_uso` (§2.1.5);
 * - tope diario (`qr.limite_diario`) y de pendientes (`qr.limite_pendientes`) por usuario: 429, sin bloquear;
 * - la bolsa mensual de la cuenta NO corta: al llegar al porcentaje de aviso y al pasarse solo deja una marca.
 * Cada rechazo por tope queda registrado aparte (§7), también aunque la transacción se deshaga.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  datos: DatosDeGeneracion,
  ahora: Date = new Date(),
): Promise<QrGenerado> {
  if (principal.estado !== 'activo') {
    throw new ErrorDeDominio('qr.generacion_restringida', 403, {
      origen: principal.origenDelEstado,
    });
  }
  const idsUnicos = [...new Set(datos.puertaIds)];
  const puertas = await crearServicioDeOrganizacion(pool).buscarPuertas(idsUnicos);
  const porId = new Map(puertas.map((puerta) => [puerta.id, puerta]));
  // Una puerta ajena, borrada o inactiva no existe para esta cuenta: 404.
  if (idsUnicos.some((id) => porId.get(id)?.activa !== true)) {
    throw new ErrorDeDominio('puerta.no_encontrada', 404);
  }

  const suscripcion = await crearServicioDeSuscripciones(pool).obtenerVigente(ahora);
  if (suscripcion === null) throw new ErrorDeDominio('suscripcion.vencida', 403);

  const limitesDeUso = crearServicioDeLimites(pool);
  const topes = await limitesDeUso.topesDe(principal.usuarioId, {
    bolsaQrMensual: suscripcion.bolsaQrMensual,
    maxPuertasPorQr: suscripcion.maxPuertasPorQr,
  });
  if (idsUnicos.length > topes.maxPuertasPorQr) {
    throw new ErrorDeDominio('qr.limite_puertas', 422, { maximo: topes.maxPuertasPorQr });
  }

  const limites = {
    ahora,
    zonasHorarias: puertas.map((puerta) => puerta.zonaHoraria),
    maxVigenciaHoras: suscripcion.maxVigenciaQrHoras,
  };
  const maximo = vencimientoMaximo(limites);
  if (datos.venceAt !== null && datos.venceAt <= ahora)
    throw new ErrorDeDominio('qr.vigencia_invalida', 422);
  if (datos.venceAt !== null && datos.venceAt > maximo) {
    throw new ErrorDeDominio('qr.vigencia_excedida', 422, { maximo: maximo.toISOString() });
  }
  const venceAt = datos.venceAt ?? vencimientoPorDefecto(limites);

  const token = generarTokenQr();
  const propio = datos.propio === true;
  const nombreDe = (puertaId: string): string => porId.get(puertaId)?.nombre ?? '';

  try {
    const generado = await enTransaccionIdempotente(pool, async (tx) => {
      // Primero se bloquea y se relee el estado (cuenta y cadena del generador): desde acá, nadie puede
      // restringirlo ni suspenderlo hasta que esta transacción termine. Es también lo que hace que dos
      // generaciones del mismo usuario se esperen entre sí y vean los conteos una de la otra.
      const efectivo = await crearServicioDeUsuarios(pool).estadoEfectivoBloqueando(
        tx,
        principal.usuarioId,
      );
      if (efectivo.estado !== 'activo') throw errorPorEstado(efectivo);

      const repositorio = new RepositorioDeQr(pool);
      const puertasDeQr = new RepositorioDePuertasDeQr(pool);
      const inicioDelDia = inicioDelDiaLocal(ahora, ZONA_DE_LOS_TOPES);

      if (propio) {
        const anterior = await repositorio.buscarPropioSinUso(tx, principal.usuarioId);
        if (anterior !== null && anterior.vence_at > ahora) {
          const actuales = (await puertasDeQr.puertasDe([anterior.id], tx)).get(anterior.id) ?? [];
          if (datos.reemplazar !== true && mismoConjunto(actuales, idsUnicos)) {
            return {
              id: anterior.id,
              texto: null,
              reutilizado: true,
              vence_at: aIso(anterior.vence_at),
              etiqueta: anterior.etiqueta,
              puertas: actuales.map((id) => ({ id, nombre: nombreDe(id) })),
            };
          }
          await comprobarReemplazo(
            tx,
            limitesDeUso,
            principal.usuarioId,
            topes,
            ahora,
            inicioDelDia,
          );
          await limitesDeUso.registrarReemplazoSinUso(tx, principal.usuarioId, ahora);
        }
        // El propio anterior (si sigue vigente, el que se reemplaza; si venció, ya no sirve) se anula en la
        // misma transacción que crea el nuevo: nunca hay dos activos (y el UNIQUE `propio_activo` lo garantiza).
        await repositorio.anularPropiosActivos(tx, principal.usuarioId, ahora);
      }

      const generadosHoy = await repositorio.contarGeneradosPor(
        principal.usuarioId,
        inicioDelDia,
        tx,
      );
      if (generadosHoy >= topes.topeDiario) {
        throw new RechazoPorTope(
          'qr.limite_diario',
          generadosHoy,
          topes.topeDiario,
          segundosHasta(finDelDiaLocal(ahora, ZONA_DE_LOS_TOPES), ahora),
        );
      }
      // Después de anular el propio que se reemplaza: ese ya no está pendiente.
      const pendientes = await repositorio.contarPendientesDe(principal.usuarioId, ahora, tx);
      if (pendientes >= topes.topePendientes) {
        throw new RechazoPorTope('qr.limite_pendientes', pendientes, topes.topePendientes, null);
      }

      const qrId = await repositorio.crear(tx, {
        generadoPor: principal.usuarioId,
        tokenHash: hashDeToken(token),
        etiqueta: datos.etiqueta,
        venceAt,
        propio,
      });
      await puertasDeQr.asociar(tx, qrId, idsUnicos);

      return {
        id: qrId,
        texto: textoDeQr(token),
        reutilizado: false,
        vence_at: aIso(venceAt),
        etiqueta: datos.etiqueta,
        puertas: idsUnicos.map((puertaId) => ({ id: puertaId, nombre: nombreDe(puertaId) })),
      };
    });
    // Fuera de la transacción: la bolsa nunca corta, así que su conteo no tiene por qué alargar el tiempo en
    // que la cadena de superiores está bloqueada (ADR 0030 §2, «Serialización por rama»).
    if (!generado.reutilizado) {
      await marcarBolsaTrasElInsert(
        pool,
        limitesDeUso,
        principal.usuarioId,
        topes,
        ahora,
        datos.log,
      );
    }
    return generado;
  } catch (error: unknown) {
    if (error instanceof RechazoPorTope) {
      // La transacción ya se deshizo: el rastro del rechazo va en la suya (ADR 0030 §7). Si registrarlo falla,
      // el 429 al usuario sigue siendo la respuesta: un error de la bitácora no lo enmascara. El crecimiento de
      // `eventos_de_limite` por estos rechazos lo acota el rate limit de la ruta (`generar_qr`, ADR 0030 §3.2).
      try {
        await limitesDeUso.registrarRechazo({
          usuarioId: principal.usuarioId,
          tipo: error.tipo,
          valor: error.actual,
          tope: error.tope,
          ahora,
        });
      } catch (falla: unknown) {
        // Solo el código del error de base: su mensaje podría traer un valor (ADR 0033 §2).
        datos.log?.warn(
          { evento: 'limite.rechazo_sin_registrar', tipo: error.tipo, codigo: codigoDe(falla) },
          'no se pudo registrar el rechazo por tope',
        );
      }
    }
    // Dos generaciones propias simultáneas no deberían llegar acá (se esperan en el bloqueo del usuario);
    // si el UNIQUE igual choca, se avisa en vez de duplicar.
    if (propio && (error as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw new ErrorDeDominio('qr.propio_en_curso', 409);
    }
    throw error;
  }
}

/**
 * Reemplazar el QR propio sin que se haya usado (ADR 0030 §2.1.5): como máximo `reemplazosSinUsoPorDia` por
 * día y con `esperaReemplazoSegundos` entre uno y otro. Solo frena el ciclo generar-anular-generar; no bloquea
 * al usuario.
 */
async function comprobarReemplazo(
  tx: Transaccion,
  limites: ServicioDeLimites,
  usuarioId: string,
  topes: TopesDeGeneracion,
  ahora: Date,
  inicioDelDia: Date,
): Promise<void> {
  const delDia = await limites.reemplazosSinUso(tx, usuarioId, inicioDelDia);
  if (delDia.total >= topes.reemplazosSinUsoPorDia) {
    throw new RechazoPorTope(
      'qr.limite_propios_sin_uso',
      delDia.total,
      topes.reemplazosSinUsoPorDia,
      segundosHasta(finDelDiaLocal(ahora, ZONA_DE_LOS_TOPES), ahora),
    );
  }
  const esperaMs = topes.esperaReemplazoSegundos * 1000;
  const recientes = await limites.reemplazosSinUso(
    tx,
    usuarioId,
    new Date(ahora.getTime() - esperaMs),
  );
  if (recientes.ultimo !== null) {
    throw new RechazoPorTope(
      'qr.limite_propios_sin_uso',
      delDia.total,
      topes.reemplazosSinUsoPorDia,
      segundosHasta(new Date(recientes.ultimo.getTime() + esperaMs), ahora),
    );
  }
}

const codigoDe = (error: unknown): string | null =>
  typeof (error as { code?: unknown } | null)?.code === 'string'
    ? (error as { code: string }).code
    : null;

/**
 * Deja la marca de la bolsa en su propia transacción corta, ya con el QR confirmado. Un fallo acá no deshace
 * ni tumba la generación (la bolsa no corta): se anota en el log y la próxima generación la marca.
 */
async function marcarBolsaTrasElInsert(
  pool: Pool,
  limites: ServicioDeLimites,
  usuarioId: string,
  topes: TopesDeGeneracion,
  ahora: Date,
  log: DatosDeGeneracion['log'],
): Promise<void> {
  try {
    await enTransaccion(pool, (tx) =>
      marcarBolsa(tx, new RepositorioDeQr(pool), limites, usuarioId, topes, ahora),
    );
  } catch (falla: unknown) {
    log?.warn(
      { evento: 'limite.bolsa_sin_marcar', codigo: codigoDe(falla) },
      'no se pudo dejar la marca de la bolsa mensual',
    );
  }
}

/**
 * La bolsa mensual de la cuenta (ADR 0030 §2) NO corta nada: con el QR ya confirmado, si la cuenta llegó al
 * porcentaje de aviso o se pasó, deja una marca que no se repite (el aviso al llegar, una vez al mes; el
 * exceso, una vez al día). De ahí lee la bandeja de avisos cuando exista.
 */
async function marcarBolsa(
  tx: Transaccion,
  repositorio: RepositorioDeQr,
  limites: ServicioDeLimites,
  usuarioId: string,
  topes: TopesDeGeneracion,
  ahora: Date,
): Promise<void> {
  const usados = await repositorio.contarGeneradosDeLaCuenta(
    inicioDelMesLocal(ahora, ZONA_DE_LOS_TOPES),
    tx,
  );
  const dia = diaLocal(ahora, ZONA_DE_LOS_TOPES);
  if (usados * 100 >= topes.bolsaMensual * topes.bolsaAvisoPorcentaje) {
    await limites.marcarBolsa(tx, {
      tipo: 'bolsa.aviso',
      usuarioId,
      valor: usados,
      tope: topes.bolsaMensual,
      claveUnica: `bolsa.aviso:${dia.slice(0, 7)}`,
      ahora,
    });
  }
  if (usados > topes.bolsaMensual) {
    await limites.marcarBolsa(tx, {
      tipo: 'bolsa.superada',
      usuarioId,
      valor: usados,
      tope: topes.bolsaMensual,
      claveUnica: `bolsa.superada:${dia}`,
      ahora,
    });
  }
}
