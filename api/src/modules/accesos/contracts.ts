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
  RepositorioDeActividadDeTodas,
  RepositorioDeConfirmaciones,
  RepositorioDeConfirmacionesDeTodas,
  RepositorioDeEventos,
  RepositorioDeQr,
  RepositorioDeQrDeTodas,
} from './repository.js';

export {
  diaLocal,
  inicioDelDiaLocal,
  inicioDelMesLocal,
  ZONA_DE_LOS_TOPES,
} from './domain/vencimiento.js';

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

interface RepeticionesPorDiaFila extends RowDataPacket {
  dia: string;
  resultado: 'permitido' | 'rechazado';
  total: string;
}

interface RepeticionesPorEventoFila extends RowDataPacket {
  original_id: string;
  resultado: 'permitido' | 'rechazado';
  total: string;
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
  // Solo el primer intento; las repeticiones se cuentan aparte (`repeticiones*`, ADR 0032 §4.2).
  const condiciones: string[] = ['t.repetido_de_id IS NULL'];
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

  /**
   * Las repeticiones por día y resultado (las filas con `repetido_de_id`, que el resto de consultas
   * excluye). Las `permitidas` son aperturas repetidas por respuesta perdida (ADR 0032 §3): se
   * cuentan aparte para que no sean invisibles.
   */
  repeticionesPorDia(desde: Date, hasta: Date, zona: string): Promise<RepeticionesPorDiaFila[]> {
    return this.seleccionar<RepeticionesPorDiaFila>({
      columnas:
        "DATE_FORMAT(CONVERT_TZ(t.ocurrido_at, '+00:00', ?), '%Y-%m-%d') AS dia, t.resultado, COUNT(*) AS total",
      donde: 't.repetido_de_id IS NOT NULL AND t.ocurrido_at >= ? AND t.ocurrido_at < ?',
      agrupar: 'dia, t.resultado',
      params: [zona, desde, hasta],
    });
  }

  /** Las repeticiones de esos intentos originales, por resultado. */
  repeticionesDe(originalIds: readonly string[]): Promise<RepeticionesPorEventoFila[]> {
    if (originalIds.length === 0) return Promise.resolve([]);
    return this.seleccionar<RepeticionesPorEventoFila>({
      columnas: 't.repetido_de_id AS original_id, t.resultado, COUNT(*) AS total',
      donde: 't.repetido_de_id IN (?)',
      params: [originalIds],
      agrupar: 't.repetido_de_id, t.resultado',
    });
  }

  contarPorDia(desde: Date, hasta: Date, zona: string): Promise<AccesosPorDiaFila[]> {
    return this.seleccionar<AccesosPorDiaFila>({
      columnas:
        "DATE_FORMAT(CONVERT_TZ(t.ocurrido_at, '+00:00', ?), '%Y-%m-%d') AS dia, t.resultado, COUNT(*) AS total",
      donde: 't.repetido_de_id IS NULL AND t.ocurrido_at >= ? AND t.ocurrido_at < ?',
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
  /** Aperturas repetidas (ADR 0032 §3): no suman a `permitidos`, pero no quedan invisibles. */
  readonly repeticionesPermitidas: number;
  /** Relecturas rechazadas enlazadas a un primer intento rechazado (ADR 0032 §4.2). */
  readonly repeticionesRechazadas: number;
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
  /** Aperturas repetidas enlazadas a este intento (respuesta perdida, ADR 0032 §3). */
  readonly repeticionesPermitidas: number;
  /** Relecturas rechazadas enlazadas a este intento (ADR 0032 §4.2). */
  readonly repeticionesRechazadas: number;
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
      const repeticiones = new Map<string, { permitidas: number; rechazadas: number }>();
      for (const fila of await repositorio.repeticionesDe(filas.map((f) => f.id))) {
        const cuenta = repeticiones.get(fila.original_id) ?? { permitidas: 0, rechazadas: 0 };
        if (fila.resultado === 'permitido') cuenta.permitidas += Number(fila.total);
        else cuenta.rechazadas += Number(fila.total);
        repeticiones.set(fila.original_id, cuenta);
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
          repeticionesPermitidas: repeticiones.get(fila.id)?.permitidas ?? 0,
          repeticionesRechazadas: repeticiones.get(fila.id)?.rechazadas ?? 0,
        })),
      };
    },
    async porDia(desde, hasta, desfaseUtc) {
      const dias = new Map<
        string,
        {
          permitidos: number;
          rechazados: number;
          repeticionesPermitidas: number;
          repeticionesRechazadas: number;
        }
      >();
      const delDia = (clave: string) => {
        const dia = dias.get(clave) ?? {
          permitidos: 0,
          rechazados: 0,
          repeticionesPermitidas: 0,
          repeticionesRechazadas: 0,
        };
        dias.set(clave, dia);
        return dia;
      };
      const [originales, repetidos] = await Promise.all([
        repositorio.contarPorDia(desde, hasta, desfaseUtc),
        repositorio.repeticionesPorDia(desde, hasta, desfaseUtc),
      ]);
      for (const fila of originales) {
        const dia = delDia(fila.dia);
        if (fila.resultado === 'permitido') dia.permitidos += Number(fila.total);
        else dia.rechazados += Number(fila.total);
      }
      for (const fila of repetidos) {
        const dia = delDia(fila.dia);
        if (fila.resultado === 'permitido') dia.repeticionesPermitidas += Number(fila.total);
        else dia.repeticionesRechazadas += Number(fila.total);
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
   * Cuáles de esos QR y esos intentos de acceso existen en la cuenta del contexto Y pertenecen a `generadores` (el
   * usuario del incidente y su rama: el QR lo generó uno de ellos; el intento leyó un QR de ellos). Un id de otra
   * cuenta, de otra rama o inventado no vuelve: así la evidencia de un incidente nunca apunta fuera de la cuenta
   * (invariante 1) ni a la actividad de quien no tiene nada que ver. Solo ids: jamás el token ni su hash.
   */
  existentes(ids: {
    readonly qrIds: readonly string[];
    readonly eventoAccesoIds: readonly string[];
    readonly generadores: readonly string[];
  }): Promise<{ qrIds: Set<string>; eventoAccesoIds: Set<string> }>;
}

export function crearServicioDeEvidencia(pool: Pool): ServicioDeEvidencia {
  const qr = new RepositorioDeQr(pool);
  const eventos = new RepositorioDeEventos(pool);
  return {
    async existentes({ qrIds, eventoAccesoIds, generadores }) {
      const [qrs, intentos] = await Promise.all([
        qr.existentes(qrIds, generadores),
        eventos.existentes(eventoAccesoIds, generadores),
      ]);
      return { qrIds: qrs, eventoAccesoIds: intentos };
    },
  };
}

/** Un usuario cuya actividad con su QR propio es sospechosa en una ventana (cantidades e ids, nunca un token). */
export interface UsuarioConActividadSospechosa {
  readonly cuentaId: string;
  readonly usuarioId: string;
  /** Aperturas (uso masivo) o pares de usos imposibles. */
  readonly total: number;
  /** Los ids de los últimos intentos de acceso, más nuevos primero. */
  readonly eventoIds: readonly string[];
}

/** Un QR cuyo rechazo `qr.usado` se repite: la huella de uno reenviado o compartido. */
export interface QrConRechazosRepetidos {
  readonly cuentaId: string;
  /** Quién generó el QR. */
  readonly usuarioId: string;
  readonly qrId: string;
  /** Rechazos `qr.usado` (todas las filas, repeticiones de un mismo intento incluidas). */
  readonly rechazos: number;
  /** Lectores (dispositivos) distintos que los vieron. */
  readonly lectores: number;
  readonly eventoIds: readonly string[];
}

/** Lo que la cuenta hizo un día local. */
export interface ActividadDeUnDia {
  /** `aaaa-mm-dd`, en la zona pedida. */
  readonly dia: string;
  /** Aperturas ordenadas por QR (el pulsador y la llave no cuentan). */
  readonly aperturas: number;
  /** Intentos rechazados. */
  readonly rechazos: number;
  /** QR generados ese día. */
  readonly generados: number;
}

export interface Cursor {
  readonly cuentaId: string;
  readonly usuarioId: string;
}

const ids = (lista: string | null | undefined): string[] =>
  lista === null || lista === undefined || lista === '' ? [] : lista.split(',');

/**
 * Lo que los detectores de señales y la vista de AGROCOM leen de los accesos (ADR 0030 §4 y §5, ola W12). Todo es
 * SOLO LECTURA y de TODAS las cuentas (salto explícito del aislamiento): el detector trata luego cada hallazgo
 * DENTRO de su cuenta. Nada de esto toca la validación ni la puerta, y las repeticiones de un mismo intento (ADR 0032
 * §4.3) cuentan como cualquier otra fila.
 */
export interface ServicioDeActividadParaSenales {
  /** Usuarios con al menos `minimo` aperturas con su QR propio entre `desde` y `hasta` (ambos incl.). */
  aperturasPropias(
    desde: Date,
    hasta: Date,
    minimo: number,
    limite: number,
    despuesDe?: Cursor | null,
  ): Promise<UsuarioConActividadSospechosa[]>;
  /** Usuarios con usos de su QR propio en puertas que no alcanzan a recorrerse (ver `usosImposibles` del repositorio). */
  usosImposibles(
    desde: Date,
    hasta: Date,
    umbrales: { entreSitiosSegundos: number; entrePuertasSegundos: number },
    limite: number,
    despuesDe?: Cursor | null,
  ): Promise<UsuarioConActividadSospechosa[]>;
  /** QR con al menos `minimo` rechazos `qr.usado` entre `desde` y `hasta`, por (cuenta, generador, QR). */
  qrReenviados(
    desde: Date,
    hasta: Date,
    minimo: number,
    limite: number,
    despuesDe?: (Cursor & { qrId: string }) | null,
  ): Promise<QrConRechazosRepetidos[]>;
  /** Cuentas con al menos `minimo` aperturas por QR entre `desde` y `hasta`, por id, a continuación de `despuesDe`. */
  cuentasConAperturas(
    desde: Date,
    hasta: Date,
    minimo: number,
    limite: number,
    despuesDe?: string | null,
  ): Promise<{ cuentaId: string; aperturas: number }[]>;
  /**
   * La actividad de esas cuentas por día local entre `desde` (incl.) y `hasta` (excl.), con `desfaseUtc` (`-04:00`);
   * una cuenta sin actividad no figura y un día sin actividad tampoco.
   */
  porDia(
    cuentaIds: readonly string[],
    desde: Date,
    hasta: Date,
    desfaseUtc: string,
  ): Promise<Map<string, ActividadDeUnDia[]>>;
  /** `cuentaId -> QR generados` entre `desde` (incl.) y `hasta` (excl.): lo que consume cada cuenta de su bolsa. */
  generadosPorCuenta(
    cuentaIds: readonly string[],
    desde: Date,
    hasta: Date,
  ): Promise<Map<string, number>>;
}

export function crearServicioDeActividadParaSenales(pool: Pool): ServicioDeActividadParaSenales {
  const actividad = new RepositorioDeActividadDeTodas(pool);
  const qr = new RepositorioDeQrDeTodas(pool);
  const aUsuarios = (
    filas: Awaited<ReturnType<typeof actividad.aperturasPropias>>,
  ): UsuarioConActividadSospechosa[] =>
    filas.map((fila) => ({
      cuentaId: fila.tenant_id,
      usuarioId: fila.usuario_id,
      total: Number(fila.total),
      eventoIds: [...new Set([...ids(fila.ids), ...ids(fila.ids_destino)])],
    }));
  return {
    async aperturasPropias(desde, hasta, minimo, limite, despuesDe = null) {
      return aUsuarios(await actividad.aperturasPropias(desde, hasta, minimo, limite, despuesDe));
    },
    async usosImposibles(desde, hasta, umbrales, limite, despuesDe = null) {
      return aUsuarios(
        await actividad.usosImposibles(
          desde,
          hasta,
          umbrales.entreSitiosSegundos,
          umbrales.entrePuertasSegundos,
          limite,
          despuesDe,
        ),
      );
    },
    async qrReenviados(desde, hasta, minimo, limite, despuesDe = null) {
      const filas = await actividad.qrReenviados(desde, hasta, minimo, limite, despuesDe);
      return filas.map((fila) => ({
        cuentaId: fila.tenant_id,
        usuarioId: fila.usuario_id,
        qrId: fila.qr_id,
        rechazos: Number(fila.rechazos),
        lectores: Number(fila.lectores),
        eventoIds: ids(fila.ids),
      }));
    },
    async cuentasConAperturas(desde, hasta, minimo, limite, despuesDe = null) {
      const filas = await actividad.cuentasConAperturas(desde, hasta, minimo, limite, despuesDe);
      return filas.map((fila) => ({ cuentaId: fila.tenant_id, aperturas: Number(fila.aperturas) }));
    },
    async porDia(cuentaIds, desde, hasta, desfaseUtc) {
      const [eventos, generados] = await Promise.all([
        actividad.porDia(cuentaIds, desde, hasta, desfaseUtc),
        qr.generadosPorDia(cuentaIds, desde, hasta, desfaseUtc),
      ]);
      interface DatosDelDia {
        aperturas: number;
        rechazos: number;
        generados: number;
      }
      const dias = new Map<string, Map<string, DatosDelDia>>();
      const de = (cuentaId: string, dia: string): DatosDelDia => {
        const porDia = dias.get(cuentaId) ?? new Map<string, DatosDelDia>();
        dias.set(cuentaId, porDia);
        const actual = porDia.get(dia) ?? { aperturas: 0, rechazos: 0, generados: 0 };
        porDia.set(dia, actual);
        return actual;
      };
      for (const fila of eventos) {
        const dia = de(fila.tenant_id, fila.dia);
        dia.aperturas = Number(fila.aperturas);
        dia.rechazos = Number(fila.rechazos);
      }
      for (const fila of generados) de(fila.tenant_id, fila.dia).generados = Number(fila.generados);
      return new Map(
        [...dias].map(([cuentaId, porDia]) => [
          cuentaId,
          [...porDia]
            .map(([dia, datos]) => ({ dia, ...datos }))
            .sort((a, b) => a.dia.localeCompare(b.dia)),
        ]),
      );
    },
    generadosPorCuenta: (cuentaIds, desde, hasta) => qr.generadosPorCuenta(cuentaIds, desde, hasta),
  };
}
