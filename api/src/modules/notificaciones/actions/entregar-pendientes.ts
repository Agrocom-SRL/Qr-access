import type { Pool, PoolConnection } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { conBloqueoDeTarea } from '../../../platform/db/bloqueo-de-tarea.js';
import { enTransaccionSobre, type Transaccion } from '../../../platform/db/transaccion.js';
import { esServicioNoDisponible } from '../../../platform/errores/servicio-no-disponible.js';
import { sumarDias, sumarMinutos } from '../../../platform/tiempo/fechas.js';
import { crearServicioDeDestinatarios } from '../../seguridad/contracts.js';
import {
  decidir,
  ENFRIAMIENTO_DE_INCIDENTE_MINUTOS,
  ESPERA_DE_REINTENTO_DE_FALLIDA_HORAS,
  ESPERA_TRAS_FALLO_TRANSITORIO_SEGUNDOS,
  esperaTrasFallo,
  INTENTOS_MAXIMOS,
  PERMISO_DE_DESTINATARIO,
  VIGENCIA_DE_REINTENTO_DE_FALLIDA_DIAS,
  type Audiencia,
  type AvisoAgrupado,
} from '../domain/aviso.js';
import {
  avisoDe,
  datosDe,
  miembrosDe,
  OperacionesDeBandeja,
  RepositorioDeCola,
  RepositorioDeColaDeTodas,
  RepositorioDeNotificaciones,
  RepositorioDeNotificacionesDePlataforma,
  type PendienteFila,
} from '../repository.js';

/** Cuántos mensajes pendientes mira cada pasada. */
const LOTE = 200;
/** Nombre del bloqueo de aplicación: un solo entregador a la vez (el orden por grupo no depende de la suerte). */
const BLOQUEO_DE_ENTREGA = 'entrega_de_notificaciones';

export interface ResultadoDeEntrega {
  readonly entregadas: number;
  /** Fallaron y quedaron para un próximo intento. */
  readonly reintentos: number;
  /** Agotaron sus intentos: quedan `fallida` para revisión (y para el re-drive). */
  readonly fallidas: number;
  /** Canales sin proveedor o mensajes superados por uno más nuevo: se anotan `omitida`, no se pierden en silencio. */
  readonly omitidas: number;
  /** `fallida` que volvieron a la cola por el re-drive. */
  readonly reprogramadas: number;
  /** Otro entregador tenía el bloqueo: esta pasada no hizo nada. */
  readonly ocupada: boolean;
}

/** Se registra (nunca se guarda) cada vez que una `fallida` vuelve a la cola, para que quede rastro. */
class MensajeFallidoReprogramado extends Error {
  constructor() {
    super('Una notificación fallida volvió a la cola');
    this.name = 'MensajeFallidoReprogramado';
  }
}

/**
 * Aplica un aviso agrupado a la bandeja de UN destinatario (idempotente: repetirlo deja lo mismo). La cuenta
 * del aviso es la del contexto, no la de la carga del mensaje.
 * - Sin incidente abierto y con miembros: abre UNA notificación con todas las placas del grupo; si el mismo
 *   grupo se cerró hace menos del enfriamiento, REABRE ese en vez de crear otro.
 * - Con incidente abierto: lo actualiza (no crea otra); si llegó alguien nuevo vuelve a ser noticia.
 * - Sin miembros: cierra el incidente y, si el aviso lo pide, deja la constancia «recuperada».
 */
async function aplicarA(
  bandeja: OperacionesDeBandeja,
  tx: Transaccion,
  destinatarioId: string,
  aviso: AvisoAgrupado,
  ahora: Date,
): Promise<void> {
  const cuentaId = ContextoCuenta.cuentaRequerida();
  const abierta = await bandeja.buscarIncidenteAbierto(tx, destinatarioId, aviso.agrupacion);
  const decision = decidir(
    abierta === null ? null : { id: abierta.id, miembros: miembrosDe(abierta) },
    aviso,
  );
  switch (decision.accion) {
    case 'abrir': {
      const cerrado = await bandeja.buscarCerradoReciente(
        tx,
        destinatarioId,
        aviso.agrupacion,
        sumarMinutos(ahora, -ENFRIAMIENTO_DE_INCIDENTE_MINUTOS),
      );
      const reapertura =
        cerrado === null ? null : decidir({ id: cerrado.id, miembros: miembrosDe(cerrado) }, aviso);
      if (cerrado !== null && reapertura?.accion === 'actualizar') {
        await bandeja.reabrirIncidente(tx, cerrado.id, {
          cantidad: aviso.miembros.length,
          miembros: reapertura.miembros,
          datos: aviso.datos,
          ahora,
          hayNovedad: reapertura.hayNovedad,
        });
        return;
      }
      await bandeja.crear(tx, {
        cuentaId,
        destinatarioId,
        tipo: aviso.tipo,
        severidad: aviso.severidad,
        sitioId: aviso.sitioId,
        agrupacionClave: aviso.agrupacion,
        claveUnica: null,
        abierta: true,
        cantidad: aviso.miembros.length,
        miembros: aviso.miembros,
        datos: aviso.datos,
        novedadAt: ahora,
      });
      return;
    }
    case 'actualizar':
      if (abierta !== null) {
        await bandeja.actualizarIncidente(tx, abierta.id, {
          cantidad: aviso.miembros.length,
          miembros: decision.miembros,
          datos: aviso.datos,
          ahora,
          hayNovedad: decision.hayNovedad,
        });
      }
      return;
    case 'cerrar': {
      if (abierta === null) return;
      await bandeja.cerrarIncidente(tx, abierta.id, ahora);
      if (aviso.alResolver === null) return;
      // Una constancia por incidente: si el mensaje se repite, la clave la reconoce.
      const clave = `resuelta:${abierta.id}`;
      if (await bandeja.existeClave(tx, destinatarioId, clave)) return;
      await bandeja.crear(tx, {
        cuentaId,
        destinatarioId,
        tipo: aviso.alResolver.tipo,
        severidad: aviso.alResolver.severidad,
        sitioId: aviso.sitioId,
        agrupacionClave: `${aviso.agrupacion}:resuelta`,
        claveUnica: clave,
        abierta: false,
        cantidad: miembrosDe(abierta).length,
        miembros: miembrosDe(abierta),
        datos: datosDe(abierta),
        novedadAt: ahora,
      });
      return;
    }
    case 'nada':
      return;
  }
}

/** Los destinatarios ya resueltos de cada (cuenta, audiencia), o el error si no se pudieron resolver. */
type Destinatarios = ReadonlyMap<string, readonly string[] | Error>;

const claveDeDestino = (tenantId: string, audiencia: Audiencia): string =>
  `${tenantId}|${audiencia}`;

/**
 * Resuelve A QUIÉN va cada audiencia ANTES de tomar el bloqueo de entrega: son lecturas con el pool, y quien
 * retiene un bloqueo no espera otra conexión del pool (ADR 0032 §1). Una lista un poco vieja (segundos) es
 * aceptable: la entrega es de avisos, no de permisos.
 */
async function resolverDestinatarios(
  pool: Pool,
  pendientes: readonly PendienteFila[],
): Promise<Destinatarios> {
  const servicio = crearServicioDeDestinatarios(pool);
  const resueltos = new Map<string, readonly string[] | Error>();
  for (const pendiente of pendientes) {
    if (pendiente.canal !== 'app') continue;
    const clave = claveDeDestino(pendiente.tenant_id, pendiente.audiencia);
    if (resueltos.has(clave)) continue;
    try {
      resueltos.set(
        clave,
        pendiente.audiencia === 'cuenta'
          ? await ContextoCuenta.ejecutarEn(pendiente.tenant_id, () =>
              servicio.deLaCuenta(PERMISO_DE_DESTINATARIO.cuenta),
            )
          : await servicio.deLaPlataforma(PERMISO_DE_DESTINATARIO.plataforma),
      );
    } catch (error) {
      resueltos.set(clave, error instanceof Error ? error : new Error(String(error)));
    }
  }
  return resueltos;
}

type Resultado = 'entregada' | 'omitida' | 'nada' | 'espera';

/**
 * Un mensaje, en su cuenta y en su propia transacción (sobre la conexión que ya sostiene el bloqueo): o se
 * aplica y se marca entregado, o nada. Bajo el bloqueo de la fila del mensaje comprueba el orden del grupo:
 * si hay un pendiente anterior, espera su turno; si ya se entregó uno posterior, este es una fotografía vieja.
 */
async function entregarUno(
  conexion: PoolConnection,
  pool: Pool,
  id: string,
  destinatarios: readonly string[],
  ahora: Date,
): Promise<Resultado> {
  return enTransaccionSobre(conexion, async (tx) => {
    const cola = new RepositorioDeCola(pool);
    const mensaje = await cola.buscarBloqueando(tx, id);
    // Otro entregador ya lo resolvió mientras esperábamos el bloqueo.
    if (mensaje?.estado !== 'pendiente') return 'nada';
    if (await cola.hayPendienteAnterior(tx, mensaje)) return 'espera';
    if (mensaje.canal !== 'app') {
      await cola.marcarOmitida(tx, id, 'canal.sin_proveedor');
      return 'omitida';
    }
    if (await cola.hayEntregadoPosterior(tx, mensaje)) {
      await cola.marcarOmitida(tx, id, 'mensaje.superado');
      return 'omitida';
    }
    const aviso = avisoDe(mensaje);
    const bandeja =
      mensaje.audiencia === 'cuenta'
        ? new RepositorioDeNotificaciones(pool).bandeja
        : new RepositorioDeNotificacionesDePlataforma(pool).bandeja;
    for (const destinatarioId of destinatarios) {
      await aplicarA(bandeja, tx, destinatarioId, aviso, ahora);
    }
    await cola.marcarEntregada(tx, id, ahora);
    return 'entregada';
  });
}

/**
 * Anota el fallo en una transacción aparte (la de la entrega ya se deshizo). Un fallo TRANSITORIO (bloqueo,
 * deadlock, pool lleno, consulta cortada) es de capacidad, no del mensaje: no cuenta como intento y se
 * reprograma pronto, para que un pico de carga no agote los intentos de un aviso bueno.
 */
async function anotarFallo(
  conexion: PoolConnection,
  pool: Pool,
  id: string,
  error: unknown,
  ahora: Date,
): Promise<boolean> {
  return enTransaccionSobre(conexion, async (tx) => {
    const cola = new RepositorioDeCola(pool);
    const mensaje = await cola.buscarBloqueando(tx, id);
    if (mensaje?.estado !== 'pendiente') return false;
    const transitorio = esServicioNoDisponible(error);
    const intentos = transitorio ? mensaje.intentos : mensaje.intentos + 1;
    const agotado = !transitorio && intentos >= INTENTOS_MAXIMOS;
    // Solo el nombre o el código del error: el texto podría traer datos de la consulta (ADR 0033).
    const codigo = codigoDeFallo(error, transitorio);
    await cola.registrarFallo(tx, id, {
      intentos,
      agotado,
      codigo,
      proximoIntentoAt: new Date(
        ahora.getTime() +
          (transitorio ? ESPERA_TRAS_FALLO_TRANSITORIO_SEGUNDOS : esperaTrasFallo(intentos)) * 1000,
      ),
    });
    return agotado;
  });
}

function codigoDeFallo(error: unknown, transitorio: boolean): string {
  const code =
    transitorio && typeof error === 'object' && error !== null && 'code' in error
      ? error.code
      : undefined;
  const nombre = error instanceof Error ? error.name : 'desconocido';
  return (typeof code === 'string' ? code : nombre).slice(0, 60);
}

/**
 * Re-drive: las `fallida` que llevan horas esperando y siguen siendo recientes vuelven a la cola con un único
 * intento más; si falla otra vez regresan a `fallida` y esperan de nuevo. Cada una deja rastro en el registro.
 */
async function reprogramarFallidas(
  conexion: PoolConnection,
  pool: Pool,
  ahora: Date,
  registrarError: (error: unknown) => void,
): Promise<number> {
  const candidatas = await new RepositorioDeColaDeTodas(pool).fallidasParaReintentar(
    sumarMinutos(ahora, -ESPERA_DE_REINTENTO_DE_FALLIDA_HORAS * 60),
    sumarDias(ahora, -VIGENCIA_DE_REINTENTO_DE_FALLIDA_DIAS),
    LOTE,
  );
  let reprogramadas = 0;
  for (const candidata of candidatas) {
    const vuelta = await ContextoCuenta.ejecutarEn(candidata.tenant_id, () =>
      enTransaccionSobre(conexion, (tx) =>
        new RepositorioDeCola(pool).reprogramar(tx, candidata.id, {
          intentos: INTENTOS_MAXIMOS - 1,
          proximoIntentoAt: ahora,
        }),
      ),
    );
    if (vuelta) {
      reprogramadas += 1;
      registrarError(new MensajeFallidoReprogramado());
    }
  }
  return reprogramadas;
}

/**
 * Entrega los avisos pendientes de la cola (outbox): at-least-once, con reintentos de espera creciente, un tope
 * de intentos y un re-drive de las `fallida`. Corre cada pocos segundos (`tareas.ts`); con el reloj inyectado se
 * prueba sin esperar.
 *
 * Orden: un solo entregador a la vez (bloqueo `GET_LOCK` global) y, además, cada mensaje comprueba bajo su
 * propia transacción que no haya un pendiente anterior de su grupo: si uno falla o aún no toca, los siguientes
 * esperan, y una fotografía vieja nunca pisa a una más nueva.
 *
 * Recursos (ADR 0032 §1): lee y resuelve destinatarios con el pool ANTES del bloqueo; ya con él, todo va por la
 * misma conexión y espera como mucho 2 s un bloqueo de fila, de modo que nada retiene un bloqueo esperando otra
 * conexión del pool.
 */
export async function ejecutar(
  pool: Pool,
  ahora: Date = new Date(),
  registrarError: (error: unknown) => void = () => undefined,
): Promise<ResultadoDeEntrega> {
  const pendientes = await new RepositorioDeColaDeTodas(pool).pendientes(ahora, LOTE);
  const destinatarios = await resolverDestinatarios(pool, pendientes);

  const resultado = await conBloqueoDeTarea(pool, BLOQUEO_DE_ENTREGA, async (conexion) => {
    const reprogramadas = await reprogramarFallidas(conexion, pool, ahora, registrarError);
    const detenidos = new Set<string>();
    let entregadas = 0;
    let reintentos = 0;
    let fallidas = 0;
    let omitidas = 0;
    for (const pendiente of pendientes) {
      // Un grupo es un tipo de aviso en un sitio para un destino; un fallo lo detiene en esta pasada.
      const grupo = `${pendiente.tenant_id}|${pendiente.agrupacion_clave}|${pendiente.audiencia}|${pendiente.canal}`;
      if (detenidos.has(grupo)) continue;
      const aQuien = destinatarios.get(claveDeDestino(pendiente.tenant_id, pendiente.audiencia));
      if (pendiente.canal === 'app' && (aQuien === undefined || aQuien instanceof Error)) {
        // No se pudo saber a quién va: no es culpa del mensaje, no gasta un intento. Se reintenta en la próxima.
        if (aQuien instanceof Error) registrarError(aQuien);
        detenidos.add(grupo);
        continue;
      }
      try {
        const entrega = await ContextoCuenta.ejecutarEn(pendiente.tenant_id, () =>
          entregarUno(
            conexion,
            pool,
            pendiente.id,
            aQuien instanceof Error || aQuien === undefined ? [] : aQuien,
            ahora,
          ),
        );
        if (entrega === 'entregada') entregadas += 1;
        if (entrega === 'omitida') omitidas += 1;
        if (entrega === 'espera') detenidos.add(grupo);
      } catch (error) {
        registrarError(error);
        detenidos.add(grupo);
        try {
          const agotado = await ContextoCuenta.ejecutarEn(pendiente.tenant_id, () =>
            anotarFallo(conexion, pool, pendiente.id, error, ahora),
          );
          if (agotado) {
            fallidas += 1;
            // Agotado: deja de frenar a los siguientes de su grupo.
            detenidos.delete(grupo);
          } else {
            reintentos += 1;
          }
        } catch (falloAlAnotar) {
          // No se pudo ni anotar (p. ej. otro bloqueo): sigue pendiente y se reintenta en la próxima pasada.
          registrarError(falloAlAnotar);
        }
      }
    }
    return { entregadas, reintentos, fallidas, omitidas, reprogramadas };
  });
  return resultado.obtenido
    ? { ...resultado.valor, ocupada: false }
    : { entregadas: 0, reintentos: 0, fallidas: 0, omitidas: 0, reprogramadas: 0, ocupada: true };
}
