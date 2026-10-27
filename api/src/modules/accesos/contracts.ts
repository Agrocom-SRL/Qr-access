import type { Pool, RowDataPacket } from 'mysql2/promise';
import { RepositorioDePlataforma } from '../../platform/db/repositorio-de-plataforma.js';
import type { Transaccion } from '../../platform/db/transaccion.js';
import {
  filaEfectiva,
  SIN_RESPUESTA,
  type CausaDeEjecucion,
  type Ejecucion,
} from './domain/confirmacion.js';
import {
  EJECUCION_EFECTIVA,
  RepositorioDeConfirmaciones,
  RepositorioDeConfirmacionesDeTodas,
  RepositorioDeEventos,
  RepositorioDeQr,
} from './repository.js';

interface AccesosPorDiaFila extends RowDataPacket {
  dia: string;
  resultado: 'permitido' | 'rechazado';
  total: string;
}

const UNIONES_DE_EVENTO =
  'JOIN cuentas AS c ON c.id = t.tenant_id ' +
  'JOIN puertas AS p ON p.id = t.puerta_id AND p.tenant_id = t.tenant_id ' +
  'JOIN sitios AS s ON s.id = p.sitio_id AND s.tenant_id = t.tenant_id ' +
  'LEFT JOIN dispositivos AS d ON d.id = t.dispositivo_id AND d.tenant_id = t.tenant_id ' +
  'LEFT JOIN qr_accesos AS q ON q.id = t.qr_acceso_id AND q.tenant_id = t.tenant_id';

export interface FiltroDeEventosDePlataforma {
  readonly cuentaId: string | null;
  readonly resultado: 'permitido' | 'rechazado' | null;
  /** Solo los eventos cuya orden de abrir terminó así; `null` o ausente = todos. */
  readonly ejecucion?: Ejecucion | null;
  readonly desde: Date | null;
  readonly hasta: Date | null;
}

interface EventoDePlataformaFila extends RowDataPacket {
  id: string;
  ocurrido_at: Date;
  resultado: 'permitido' | 'rechazado';
  motivo_code: string;
  cuenta_id: string;
  cuenta_codigo: string;
  cuenta_nombre: string;
  puerta_id: string;
  puerta_nombre: string;
  sitio_nombre: string;
  dispositivo_nombre: string | null;
  qr_etiqueta: string | null;
}

/** El `WHERE` de los filtros presentes; los valores van siempre como parámetros. */
function armarFiltro(filtro: FiltroDeEventosDePlataforma): { donde?: string; params: unknown[] } {
  const condiciones: string[] = [];
  const params: unknown[] = [];
  if (filtro.cuentaId !== null) {
    condiciones.push('t.tenant_id = ?');
    params.push(filtro.cuentaId);
  }
  if (filtro.resultado !== null) {
    condiciones.push('t.resultado = ?');
    params.push(filtro.resultado);
  }
  if (filtro.ejecucion !== undefined && filtro.ejecucion !== null) {
    condiciones.push(EJECUCION_EFECTIVA + ' = ?');
    params.push(filtro.ejecucion);
  }
  if (filtro.desde !== null) {
    condiciones.push('t.ocurrido_at >= ?');
    params.push(filtro.desde);
  }
  if (filtro.hasta !== null) {
    condiciones.push('t.ocurrido_at < ?');
    params.push(filtro.hasta);
  }
  return condiciones.length === 0 ? { params } : { donde: condiciones.join(' AND '), params };
}

/**
 * Cuántos intentos de acceso hubo por día en TODAS las cuentas, para las gráficas del panel de
 * plataforma. Salto EXPLÍCITO del aislamiento: solo lee totales agregados, nunca filas de una
 * cuenta ni escribe (`eventos_acceso` es de solo inserción).
 */
class RepositorioDeAccesosDeTodas extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'eventos_acceso',
      columnas: [],
      perfil: 'solo_insercion',
      deCuenta: true,
    });
  }

  /**
   * Los intentos de todas las cuentas, del más nuevo al más viejo, con quién es la cuenta, la
   * puerta y el lector. Las uniones leen nombres para mostrar; no escriben nada.
   */
  listar(
    filtro: FiltroDeEventosDePlataforma,
    limite: number,
    desplazamiento: number,
  ): Promise<EventoDePlataformaFila[]> {
    const { donde, params } = armarFiltro(filtro);
    return this.seleccionar<EventoDePlataformaFila>({
      columnas:
        't.id, t.ocurrido_at, t.resultado, t.motivo_code, ' +
        'c.id AS cuenta_id, c.codigo AS cuenta_codigo, c.nombre AS cuenta_nombre, ' +
        'p.id AS puerta_id, p.nombre AS puerta_nombre, s.nombre AS sitio_nombre, ' +
        'd.nombre AS dispositivo_nombre, q.etiqueta AS qr_etiqueta',
      uniones: UNIONES_DE_EVENTO,
      ...(donde === undefined ? {} : { donde }),
      params,
      orden: 't.ocurrido_at DESC, t.id DESC',
      limite,
      desplazamiento,
    });
  }

  contarTodos(filtro: FiltroDeEventosDePlataforma): Promise<number> {
    const { donde, params } = armarFiltro(filtro);
    return this.contar({
      uniones: UNIONES_DE_EVENTO,
      ...(donde === undefined ? {} : { donde }),
      params,
    });
  }

  contarPorDia(desde: Date, hasta: Date, zona: string): Promise<AccesosPorDiaFila[]> {
    return this.seleccionar<AccesosPorDiaFila>({
      columnas:
        "DATE_FORMAT(CONVERT_TZ(t.ocurrido_at, '+00:00', ?), '%Y-%m-%d') AS dia, t.resultado, COUNT(*) AS total",
      donde: 't.ocurrido_at >= ? AND t.ocurrido_at < ?',
      agrupar: 'dia, t.resultado',
      params: [zona, desde, hasta],
      orden: 'dia',
    });
  }
}

export interface AccesosDelDia {
  /** `aaaa-mm-dd`, en la zona pedida. */
  readonly dia: string;
  readonly permitidos: number;
  readonly rechazados: number;
}

export interface EventoDePlataforma {
  readonly id: string;
  readonly ocurridoAt: Date;
  readonly resultado: 'permitido' | 'rechazado';
  readonly motivoCode: string;
  readonly cuenta: { readonly id: string; readonly codigo: string; readonly nombre: string };
  readonly puerta: { readonly id: string; readonly nombre: string; readonly sitio: string };
  readonly dispositivo: string | null;
  readonly qrEtiqueta: string | null;
  /** Qué pasó con la orden de abrir (ADR 0031 §18); `null` en un rechazo o sin informe todavía. */
  readonly ejecucion: Ejecucion | null;
  /** La causa del resultado de la ejecución (`puerta_no_abrio`, `sin_respuesta`...); `null` si no hay ejecución. */
  readonly ejecucionCausa: CausaDeEjecucion | null;
}

export interface ServicioDeAccesosDePlataforma {
  /** Los intentos de todas las cuentas (o de una), paginados, del más nuevo al más viejo. */
  listar(
    filtro: FiltroDeEventosDePlataforma,
    limite: number,
    desplazamiento: number,
  ): Promise<{ eventos: EventoDePlataforma[]; total: number }>;
  /** Los días con al menos un intento entre `desde` (incl.) y `hasta` (excl.); los días sin intentos no figuran. */
  porDia(desde: Date, hasta: Date, desfaseUtc: string): Promise<AccesosDelDia[]>;
}

export function crearServicioDeAccesosDePlataforma(pool: Pool): ServicioDeAccesosDePlataforma {
  const repositorio = new RepositorioDeAccesosDeTodas(pool);
  const confirmaciones = new RepositorioDeConfirmacionesDeTodas(pool);
  return {
    async listar(filtro, limite, desplazamiento) {
      const [filas, total] = await Promise.all([
        repositorio.listar(filtro, limite, desplazamiento),
        repositorio.contarTodos(filtro),
      ]);
      const efectivas = new Map<string, { ejecucion: Ejecucion; causa: CausaDeEjecucion }>();
      const porEvento = new Map<string, Awaited<ReturnType<typeof confirmaciones.deEventos>>>();
      for (const fila of await confirmaciones.deEventos(filas.map((evento) => evento.id))) {
        porEvento.set(fila.evento_acceso_id, [
          ...(porEvento.get(fila.evento_acceso_id) ?? []),
          fila,
        ]);
      }
      for (const [eventoId, deUnEvento] of porEvento) {
        const efectiva = filaEfectiva(deUnEvento);
        if (efectiva !== null) {
          efectivas.set(eventoId, { ejecucion: efectiva.resultado, causa: efectiva.causa });
        }
      }
      return {
        total,
        eventos: filas.map((fila) => ({
          id: fila.id,
          ocurridoAt: fila.ocurrido_at,
          resultado: fila.resultado,
          motivoCode: fila.motivo_code,
          cuenta: { id: fila.cuenta_id, codigo: fila.cuenta_codigo, nombre: fila.cuenta_nombre },
          puerta: { id: fila.puerta_id, nombre: fila.puerta_nombre, sitio: fila.sitio_nombre },
          dispositivo: fila.dispositivo_nombre,
          qrEtiqueta: fila.qr_etiqueta,
          ejecucion: efectivas.get(fila.id)?.ejecucion ?? null,
          ejecucionCausa: efectivas.get(fila.id)?.causa ?? null,
        })),
      };
    },
    async porDia(desde, hasta, desfaseUtc) {
      const dias = new Map<string, { permitidos: number; rechazados: number }>();
      for (const fila of await repositorio.contarPorDia(desde, hasta, desfaseUtc)) {
        const dia = dias.get(fila.dia) ?? { permitidos: 0, rechazados: 0 };
        if (fila.resultado === 'permitido') dia.permitidos += Number(fila.total);
        else dia.rechazados += Number(fila.total);
        dias.set(fila.dia, dia);
      }
      return [...dias.entries()].map(([dia, cuenta]) => ({ dia, ...cuenta }));
    },
  };
}

/** Lo que un usuario hizo con sus QR en una ventana (estadísticas de uso, ADR 0028). */
export interface ActividadDeGenerador {
  readonly generados: number;
  readonly usados: number;
  /** El mayor número de QR generados en un solo día de la ventana. */
  readonly maxEnUnDia: number;
  /** El último QR generado, de cualquier fecha; `null` si nunca generó uno. */
  readonly ultimoGeneradoAt: Date | null;
}

export interface ServicioDeActividadDeQr {
  /**
   * La actividad de esos usuarios de la cuenta del contexto desde `desde`. Un usuario que no generó
   * ningún QR figura con ceros, así que quien llama no tiene que distinguir "sin datos" de "sin uso".
   */
  deGeneradores(
    usuarioIds: readonly string[],
    desde: Date,
    desfaseUtc: string,
  ): Promise<Map<string, ActividadDeGenerador>>;
}

export function crearServicioDeActividadDeQr(pool: Pool): ServicioDeActividadDeQr {
  const repositorio = new RepositorioDeQr(pool);
  return {
    async deGeneradores(usuarioIds, desde, desfaseUtc) {
      const [conteos, maximos, ultimos] = await Promise.all([
        repositorio.actividadDesde(usuarioIds, desde),
        repositorio.maxEnUnDiaDesde(usuarioIds, desde, desfaseUtc),
        repositorio.ultimoGeneradoDe(usuarioIds),
      ]);
      return new Map(
        usuarioIds.map((id) => [
          id,
          {
            generados: conteos.get(id)?.generados ?? 0,
            usados: conteos.get(id)?.usados ?? 0,
            maxEnUnDia: maximos.get(id) ?? 0,
            ultimoGeneradoAt: ultimos.get(id) ?? null,
          },
        ]),
      );
    },
  };
}

export interface ServicioDeAnulacionDeQr {
  /**
   * Anula, dentro de la transacción `tx`, los QR vigentes de esos usuarios de la cuenta del contexto (o
   * de toda la cuenta con `null`). Es la mitad «QR» de suspender a un usuario, a su rama o a la cuenta
   * (ADR 0031 §1): se hace en la misma transacción que el cambio de estado. Los anulados no reviven.
   */
  anularVigentes(
    tx: Transaccion,
    generadores: readonly string[] | null,
    anuladoPor: string,
    ahora: Date,
  ): Promise<number>;
}

export function crearServicioDeAnulacionDeQr(pool: Pool): ServicioDeAnulacionDeQr {
  const repositorio = new RepositorioDeQr(pool);
  return {
    anularVigentes: (tx, generadores, anuladoPor, ahora) =>
      repositorio.anularVigentes(tx, generadores, anuladoPor, ahora),
  };
}

export interface ServicioDeLecturas {
  /** `puertaId -> última lectura del lector` de la cuenta del contexto; una puerta sin lecturas no figura. */
  ultimaLecturaPorPuertas(puertaIds: readonly string[]): Promise<Map<string, Date>>;
}

export function crearServicioDeLecturas(pool: Pool): ServicioDeLecturas {
  const eventos = new RepositorioDeEventos(pool);
  return { ultimaLecturaPorPuertas: (puertaIds) => eventos.ultimaLecturaPorPuertas(puertaIds) };
}

/** Una apertura que el servidor ordenó y de la que nadie ha informado nada. */
export interface AperturaSinInforme {
  readonly eventoId: string;
  readonly dispositivoId: string;
  readonly puertaId: string;
  readonly ocurridoAt: Date;
}

/** Lo que pasó con una apertura ordenada (el estado efectivo: la placa manda sobre el servidor). */
export interface EjecucionDeApertura {
  readonly eventoId: string;
  readonly dispositivoId: string;
  readonly puertaId: string;
  /** Hora (UTC) de la orden de abrir que esta ejecución confirma. */
  readonly ocurridoAt: Date;
  readonly resultado: Ejecucion;
  readonly causa: CausaDeEjecucion;
  /** Hora del servidor en que se registró. */
  readonly registradaAt: Date;
}

export interface ServicioDeConfirmaciones {
  /**
   * Las aperturas por QR de cada dispositivo desde SU `desde` (incl.) hasta `hasta` (excl.) sin ningún informe, en
   * la cuenta del contexto. Lectura sin bloqueo.
   */
  aperturasSinInforme(
    dispositivos: readonly { readonly dispositivoId: string; readonly desde: Date }[],
    hasta: Date,
    limite: number,
  ): Promise<AperturaSinInforme[]>;
  /**
   * Deja la constancia `sin_confirmacion` / `sin_respuesta` del servidor dentro de `tx`; `false` si ya había una.
   * `registradaAt` es el instante en que venció el plazo (la orden + el plazo), no «ahora»: así una caída del
   * detector no mueve la constancia dentro de la ventana de juicio.
   */
  dejarSinRespuesta(
    tx: Transaccion,
    apertura: AperturaSinInforme,
    registradaAt: Date,
  ): Promise<boolean>;
  /** El estado efectivo de las aperturas registradas desde `desde`, en la cuenta del contexto. Lectura sin bloqueo. */
  ejecucionesDesde(desde: Date, limite: number): Promise<EjecucionDeApertura[]>;
}

export function crearServicioDeConfirmaciones(pool: Pool): ServicioDeConfirmaciones {
  const eventos = new RepositorioDeEventos(pool);
  const confirmaciones = new RepositorioDeConfirmaciones(pool);
  return {
    async aperturasSinInforme(dispositivos, hasta, limite) {
      const filas = await eventos.aperturasSinInforme(dispositivos, hasta, limite);
      return filas.map((fila) => ({
        eventoId: fila.id,
        dispositivoId: fila.dispositivo_id,
        puertaId: fila.puerta_id,
        ocurridoAt: fila.ocurrido_at,
      }));
    },
    async dejarSinRespuesta(tx, apertura, registradaAt) {
      const id = await confirmaciones.registrar(tx, {
        eventoId: apertura.eventoId,
        dispositivoId: apertura.dispositivoId,
        puertaId: apertura.puertaId,
        origen: 'servidor',
        ...SIN_RESPUESTA,
        reportadoEnDispositivoAt: null,
        registradaAt,
      });
      return id !== null;
    },
    async ejecucionesDesde(desde, limite) {
      const filas = await confirmaciones.registradasDesde(desde, limite);
      const porEvento = new Map<string, typeof filas>();
      for (const fila of filas) {
        porEvento.set(fila.evento_acceso_id, [
          ...(porEvento.get(fila.evento_acceso_id) ?? []),
          fila,
        ]);
      }
      return [...porEvento.values()].flatMap((deUnEvento) => {
        const efectiva = filaEfectiva(deUnEvento);
        return efectiva === null
          ? []
          : [
              {
                eventoId: efectiva.evento_acceso_id,
                dispositivoId: efectiva.dispositivo_id,
                puertaId: efectiva.puerta_id,
                ocurridoAt: efectiva.ocurrido_at,
                resultado: efectiva.resultado,
                causa: efectiva.causa,
                registradaAt: efectiva.registrada_at,
              },
            ];
      });
    },
  };
}

export interface ServicioDeEvidencia {
  /**
   * Cuáles de esos QR y esos intentos de acceso existen en la cuenta del contexto. Un id de otra cuenta o inventado
   * no vuelve: así la evidencia de un incidente nunca apunta fuera de la cuenta (invariante 1). Solo ids: jamás el
   * token ni su hash.
   */
  existentes(ids: {
    readonly qrIds: readonly string[];
    readonly eventoAccesoIds: readonly string[];
  }): Promise<{ qrIds: Set<string>; eventoAccesoIds: Set<string> }>;
}

export function crearServicioDeEvidencia(pool: Pool): ServicioDeEvidencia {
  const qr = new RepositorioDeQr(pool);
  const eventos = new RepositorioDeEventos(pool);
  return {
    async existentes({ qrIds, eventoAccesoIds }) {
      const [qrs, intentos] = await Promise.all([
        qr.existentes(qrIds),
        eventos.existentes(eventoAccesoIds),
      ]);
      return { qrIds: qrs, eventoAccesoIds: intentos };
    },
  };
}
