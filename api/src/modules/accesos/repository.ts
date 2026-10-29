import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { RepositorioDeCuenta } from '../../platform/db/repositorio-de-cuenta.js';
import { RepositorioDePlataforma } from '../../platform/db/repositorio-de-plataforma.js';
import type { Transaccion } from '../../platform/db/transaccion.js';
import type { CausaDeEjecucion, Ejecucion, OrigenDeConfirmacion } from './domain/confirmacion.js';
import type { EstadoDeQr } from './domain/estado-qr.js';
import type { OperacionIdempotente } from './domain/idempotencia.js';
import { TODA_LA_CUENTA, type IdsOTodaLaCuenta } from '../../platform/db/alcance.js';

export interface QrFila extends RowDataPacket {
  id: string;
  generado_por: string;
  etiqueta: string | null;
  vence_at: Date;
  usado_at: Date | null;
  anulado_at: Date | null;
  created_at: Date;
}

export interface QrParaRepetirFila extends RowDataPacket {
  token_hash: string;
  vence_at: Date;
  usado_at: Date | null;
  anulado_at: Date | null;
}

const COLUMNAS_DE_QR =
  't.id, t.generado_por, t.etiqueta, t.vence_at, t.usado_at, t.anulado_at, t.created_at';

export interface NuevoQr {
  readonly generadoPor: string;
  readonly tokenHash: string;
  readonly etiqueta: string | null;
  readonly venceAt: Date;
  /** El QR de "Mi QR de acceso": no se lista en "Mis QR" y solo hay uno activo por usuario. */
  readonly propio?: boolean;
}

export interface FiltroDeQr {
  readonly estado: EstadoDeQr | null;
  /** Solo los generados por este usuario; `null` = todos los de la cuenta. */
  readonly generadoPor: string | null;
  readonly ahora: Date;
}

/** Cada estado se deriva de las fechas, igual que `estadoDelQr`: anulado > usado > vencido > vigente. */
const CONDICION_DE_ESTADO: Readonly<Record<EstadoDeQr, string>> = {
  anulado: 't.anulado_at IS NOT NULL',
  usado: 't.anulado_at IS NULL AND t.usado_at IS NOT NULL',
  vencido: 't.anulado_at IS NULL AND t.usado_at IS NULL AND t.vence_at <= ?',
  vigente: 't.anulado_at IS NULL AND t.usado_at IS NULL AND t.vence_at > ?',
};

function armarFiltro(filtro: FiltroDeQr): { donde?: string; params: unknown[] } {
  // Los QR propios no se listan ni se cuentan: se presentan como una entrada fija.
  const condiciones: string[] = ['t.es_propio = 0'];
  const params: unknown[] = [];
  if (filtro.estado !== null) {
    condiciones.push(CONDICION_DE_ESTADO[filtro.estado]);
    if (filtro.estado === 'vencido' || filtro.estado === 'vigente') params.push(filtro.ahora);
  }
  if (filtro.generadoPor !== null) {
    condiciones.push('t.generado_por = ?');
    params.push(filtro.generadoPor);
  }
  return { donde: condiciones.join(' AND '), params };
}

interface ConteoDeQrFila extends RowDataPacket {
  generado_por: string;
  generados: number | string;
  usados: number | string | null;
}

interface QrPorDiaFila extends RowDataPacket {
  generado_por: string;
  dia: string;
  total: number | string;
}

interface UltimoQrFila extends RowDataPacket {
  generado_por: string;
  ultimo: Date;
}

/** Dueño de `qr_accesos`. */
export class RepositorioDeQr extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'qr_accesos',
      columnas: [
        'generado_por',
        'token_hash',
        'etiqueta',
        'es_propio',
        'vence_at',
        'usado_at',
        'usado_dispositivo_id',
        'anulado_at',
        'anulado_por',
      ],
      sensibles: ['token_hash'],
      perfil: 'dominio',
      deCuenta: true,
    });
  }

  crear(tx: Transaccion, qr: NuevoQr): Promise<string> {
    return this.insertar(tx, {
      generado_por: qr.generadoPor,
      token_hash: qr.tokenHash,
      etiqueta: qr.etiqueta,
      es_propio: qr.propio === true ? 1 : 0,
      vence_at: qr.venceAt,
    });
  }

  /**
   * Anula los QR propios todavía activos del usuario (aunque ya hayan vencido): al generar uno
   * nuevo, el anterior deja de servir. Si alguien le sacó una foto, esa foto ya no abre.
   */
  async anularPropiosActivos(tx: Transaccion, usuarioId: string, ahora: Date): Promise<number> {
    const activos = await this.seleccionar<QrFila>({
      columnas: COLUMNAS_DE_QR,
      donde:
        't.generado_por = ? AND t.es_propio = 1 AND t.anulado_at IS NULL AND t.usado_at IS NULL',
      params: [usuarioId],
    });
    for (const activo of activos) await this.anular(tx, activo.id, usuarioId, ahora);
    return activos.length;
  }

  /**
   * El QR propio del usuario que todavía no se usó ni se anuló (aunque haya vencido), bloqueado hasta el
   * fin de la transacción. Hay a lo sumo uno: lo garantiza el UNIQUE `propio_activo`.
   */
  buscarPropioSinUso(tx: Transaccion, usuarioId: string): Promise<QrFila | null> {
    return this.seleccionarUna<QrFila>(
      {
        columnas: COLUMNAS_DE_QR,
        donde:
          't.generado_por = ? AND t.es_propio = 1 AND t.anulado_at IS NULL AND t.usado_at IS NULL',
        params: [usuarioId],
        bloquear: true,
      },
      tx,
    );
  }

  /** Cuántos QR generó el usuario desde `desde` (de cualquier clase y en cualquier estado): el tope diario. */
  contarGeneradosPor(usuarioId: string, desde: Date, tx: Transaccion): Promise<number> {
    return this.contar(
      { donde: 't.generado_por = ? AND t.created_at >= ?', params: [usuarioId, desde] },
      tx,
    );
  }

  /** Cuántos QR vigentes sin usar tiene el usuario: el tope de pendientes. */
  contarPendientesDe(usuarioId: string, ahora: Date, tx: Transaccion): Promise<number> {
    return this.contar(
      {
        donde:
          't.generado_por = ? AND t.anulado_at IS NULL AND t.usado_at IS NULL AND t.vence_at > ?',
        params: [usuarioId, ahora],
      },
      tx,
    );
  }

  /** Cuántos QR generó la cuenta del contexto desde `desde`: lo que consume de su bolsa mensual. */
  contarGeneradosDeLaCuenta(desde: Date, tx: Transaccion): Promise<number> {
    return this.contar({ donde: 't.created_at >= ?', params: [desde] }, tx);
  }

  /**
   * Anula los QR vigentes (sin usar, sin anular y sin vencer) de esos generadores, o de TODA la cuenta
   * del contexto si `generadores` es `null`. Lo usa la suspensión de un usuario, de su rama o de la
   * cuenta, en la transacción de la suspensión (ADR 0031 §1). Cada anulación pasa por `anular`, que
   * deja su rastro en la bitácora. Devuelve cuántos anuló.
   */
  async anularVigentes(
    tx: Transaccion,
    generadores: readonly string[] | null,
    anuladoPor: string,
    ahora: Date,
  ): Promise<number> {
    if (generadores !== null && generadores.length === 0) return 0;
    const vigentes = await this.seleccionar<QrFila>(
      {
        columnas: COLUMNAS_DE_QR,
        donde:
          generadores === null
            ? 't.anulado_at IS NULL AND t.usado_at IS NULL AND t.vence_at > ?'
            : 't.anulado_at IS NULL AND t.usado_at IS NULL AND t.vence_at > ? AND t.generado_por IN (?)',
        params: generadores === null ? [ahora] : [ahora, generadores],
        bloquear: true,
      },
      tx,
    );
    let anulados = 0;
    for (const qr of vigentes) {
      if (await this.anular(tx, qr.id, anuladoPor, ahora)) anulados += 1;
    }
    return anulados;
  }

  /**
   * UN LOTE de la anulación masiva: anula hasta `tamano` QR vigentes de esos generadores con id mayor que `despuesDe`
   * (un cursor por id, así un QR que no se pudo anular no se vuelve a pedir y el ciclo siempre termina). Va en la
   * transacción `tx` de quien lo llama, que debe ser corta: bloquea solo esas filas (y su índice único) hasta el
   * COMMIT, no todos los QR del alcance. Devuelve cuántos anuló, cuántos leyó y el último id leído (`null` si no
   * había ninguno).
   */
  async anularLoteDeVigentes(
    tx: Transaccion,
    generadores: IdsOTodaLaCuenta,
    anuladoPor: string,
    ahora: Date,
    despuesDe: string,
    tamano: number,
  ): Promise<{ anulados: number; leidos: number; ultimoId: string | null }> {
    if (generadores !== TODA_LA_CUENTA && generadores.length === 0) {
      return { anulados: 0, leidos: 0, ultimoId: null };
    }
    const vigentes = 't.anulado_at IS NULL AND t.usado_at IS NULL AND t.vence_at > ?';
    const lote = await this.seleccionar<QrFila>(
      {
        columnas: COLUMNAS_DE_QR,
        // `TODA_LA_CUENTA` no filtra por generador: alcanza también los QR de un usuario ya dado de baja
        // (la lista de generadores solo trae a los no borrados). El repositorio sigue filtrando por la cuenta.
        donde:
          generadores === TODA_LA_CUENTA
            ? `${vigentes} AND t.id > ?`
            : `${vigentes} AND t.generado_por IN (?) AND t.id > ?`,
        params:
          generadores === TODA_LA_CUENTA ? [ahora, despuesDe] : [ahora, generadores, despuesDe],
        orden: 't.id',
        limite: tamano,
        bloquear: true,
      },
      tx,
    );
    let anulados = 0;
    for (const qr of lote) {
      if (await this.anular(tx, qr.id, anuladoPor, ahora)) anulados += 1;
    }
    return { anulados, leidos: lote.length, ultimoId: lote.at(-1)?.id ?? null };
  }

  /**
   * Cuántos QR generó cada usuario desde `desde` y cuántos de ellos ya se usaron (estadísticas de uso,
   * ADR 0028). Cuenta también los QR propios. Un usuario sin QR no aparece.
   */
  async actividadDesde(
    usuarioIds: readonly string[],
    desde: Date,
  ): Promise<Map<string, { generados: number; usados: number }>> {
    const mapa = new Map<string, { generados: number; usados: number }>();
    if (usuarioIds.length === 0) return mapa;
    const filas = await this.seleccionar<ConteoDeQrFila>({
      columnas: 't.generado_por, COUNT(*) AS generados, SUM(t.usado_at IS NOT NULL) AS usados',
      donde: 't.generado_por IN (?) AND t.created_at >= ?',
      params: [usuarioIds, desde],
      agrupar: 't.generado_por',
    });
    for (const fila of filas) {
      mapa.set(fila.generado_por, {
        generados: Number(fila.generados),
        usados: Number(fila.usados),
      });
    }
    return mapa;
  }

  /**
   * El mayor número de QR que cada usuario generó en un solo día desde `desde`. El día se corta con
   * `desfaseUtc` (`-04:00`: La Paz), una constante del código y nunca un valor del usuario.
   */
  async maxEnUnDiaDesde(
    usuarioIds: readonly string[],
    desde: Date,
    desfaseUtc: string,
  ): Promise<Map<string, number>> {
    const mapa = new Map<string, number>();
    if (usuarioIds.length === 0) return mapa;
    if (!/^[+-]\d{2}:\d{2}$/.test(desfaseUtc)) throw new Error('Desfase horario inválido');
    const filas = await this.seleccionar<QrPorDiaFila>({
      columnas: `t.generado_por, DATE_FORMAT(CONVERT_TZ(t.created_at, '+00:00', '${desfaseUtc}'), '%Y-%m-%d') AS dia, COUNT(*) AS total`,
      donde: 't.generado_por IN (?) AND t.created_at >= ?',
      params: [usuarioIds, desde],
      agrupar: 't.generado_por, dia',
    });
    for (const fila of filas) {
      mapa.set(fila.generado_por, Math.max(mapa.get(fila.generado_por) ?? 0, Number(fila.total)));
    }
    return mapa;
  }

  /** El último QR que generó cada usuario, de cualquier fecha. */
  async ultimoGeneradoDe(usuarioIds: readonly string[]): Promise<Map<string, Date>> {
    const mapa = new Map<string, Date>();
    if (usuarioIds.length === 0) return mapa;
    const filas = await this.seleccionar<UltimoQrFila>({
      columnas: 't.generado_por, MAX(t.created_at) AS ultimo',
      donde: 't.generado_por IN (?)',
      params: [usuarioIds],
      agrupar: 't.generado_por',
    });
    for (const fila of filas) mapa.set(fila.generado_por, fila.ultimo);
    return mapa;
  }

  /** Busca SOLO dentro de la cuenta del contexto (ADR 0008 paso 2): un QR de otra cuenta es desconocido. */
  buscarPorHash(tokenHash: string): Promise<QrFila | null> {
    return this.seleccionarUna<QrFila>({
      columnas: COLUMNAS_DE_QR,
      donde: 't.token_hash = ?',
      params: [tokenHash],
    });
  }

  buscarPorId(id: string): Promise<QrFila | null> {
    return this.seleccionarUna<QrFila>({
      columnas: COLUMNAS_DE_QR,
      donde: 't.id = ?',
      params: [id],
    });
  }

  /**
   * Cuáles de esos ids existen en la cuenta del contexto Y los generó alguno de `generadores` (evidencia de un
   * incidente: tiene que ser del usuario o de su rama, ADR 0033 §4).
   */
  async existentes(ids: readonly string[], generadores: readonly string[]): Promise<Set<string>> {
    if (ids.length === 0 || generadores.length === 0) return new Set();
    const filas = await this.seleccionar<RowDataPacket>({
      columnas: 't.id',
      donde: 't.id IN (?) AND t.generado_por IN (?)',
      params: [ids, generadores],
    });
    return new Set(filas.map((fila) => String(fila.id)));
  }

  /**
   * Lo que hace falta para repetir una generación idempotente: el hash guardado del token (para comprobar que el
   * derivado es el mismo) y el estado. Aparte de `buscarPorId` para que el hash no viaje con las demás lecturas.
   */
  buscarParaRepetir(id: string, tx?: Transaccion): Promise<QrParaRepetirFila | null> {
    return this.seleccionarUna<QrParaRepetirFila>(
      {
        columnas: 't.token_hash, t.vence_at, t.usado_at, t.anulado_at',
        donde: 't.id = ?',
        params: [id],
      },
      tx,
    );
  }

  listar(filtro: FiltroDeQr, limite: number, desplazamiento: number): Promise<QrFila[]> {
    const { donde, params } = armarFiltro(filtro);
    return this.seleccionar<QrFila>({
      columnas: COLUMNAS_DE_QR,
      ...(donde === undefined ? {} : { donde }),
      params,
      orden: 't.created_at DESC, t.id DESC',
      limite,
      desplazamiento,
    });
  }

  contarFiltrados(filtro: FiltroDeQr): Promise<number> {
    const { donde, params } = armarFiltro(filtro);
    return this.contar({ ...(donde === undefined ? {} : { donde }), params });
  }

  /** Cuántos QR hay en cada estado (las pastillas de "Mis QR"). */
  async contarPorEstado(
    generadoPor: string | null,
    ahora: Date,
  ): Promise<Record<EstadoDeQr, number>> {
    const conteos = { vigente: 0, usado: 0, vencido: 0, anulado: 0 };
    for (const estado of Object.keys(conteos) as EstadoDeQr[]) {
      conteos[estado] = await this.contarFiltrados({ estado, generadoPor, ahora });
    }
    return conteos;
  }

  /**
   * Paso 7 del ADR 0008: consumo atómico. El UPDATE solo afecta la fila si sigue sin usar, sin
   * anular y sin vencer; si dos lectores compiten, uno recibe `true` y el otro `false`.
   */
  consumir(tx: Transaccion, id: string, dispositivoId: string, ahora: Date): Promise<boolean> {
    return this.actualizar(
      tx,
      id,
      { usado_at: ahora, usado_dispositivo_id: dispositivoId },
      {
        cuando: {
          sql: 'usado_at IS NULL AND anulado_at IS NULL AND vence_at > ?',
          params: [ahora],
        },
      },
    );
  }

  anular(tx: Transaccion, id: string, usuarioId: string, ahora: Date): Promise<boolean> {
    return this.actualizar(
      tx,
      id,
      { anulado_at: ahora, anulado_por: usuarioId },
      { cuando: { sql: 'usado_at IS NULL AND anulado_at IS NULL' } },
    );
  }
}

interface PuertaDeQrFila extends RowDataPacket {
  qr_acceso_id: string;
  puerta_id: string;
}

/** Dueño de `qr_acceso_puertas`: a qué puertas abre cada QR. */
export class RepositorioDePuertasDeQr extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'qr_acceso_puertas',
      columnas: ['qr_acceso_id', 'puerta_id'],
      perfil: 'dominio_sin_bitacora',
      deCuenta: true,
    });
  }

  async asociar(tx: Transaccion, qrId: string, puertaIds: readonly string[]): Promise<void> {
    for (const puertaId of puertaIds) {
      await this.insertar(tx, { qr_acceso_id: qrId, puerta_id: puertaId });
    }
  }

  /**
   * `qrId -> ids de puerta`, en el orden en que se asociaron. Dentro de una transacción, pásale `tx`: sin ella
   * toma otra conexión del pool y una petición retiene dos (se cuelga con el pool lleno).
   */
  async puertasDe(qrIds: readonly string[], tx?: Transaccion): Promise<Map<string, string[]>> {
    const mapa = new Map<string, string[]>();
    if (qrIds.length === 0) return mapa;
    const filas = await this.seleccionar<PuertaDeQrFila>(
      {
        columnas: 't.qr_acceso_id, t.puerta_id',
        donde: 't.qr_acceso_id IN (?)',
        params: [qrIds],
        orden: 't.id',
      },
      tx,
    );
    for (const fila of filas) {
      mapa.set(fila.qr_acceso_id, [...(mapa.get(fila.qr_acceso_id) ?? []), fila.puerta_id]);
    }
    return mapa;
  }
}

export interface LecturaFila extends RowDataPacket {
  id: string;
  ocurrido_at: Date;
  resultado: 'permitido' | 'rechazado';
  motivo_code: string;
  puerta_id: string;
  /** Cómo se originó: `qr`, `pulsador`, `forzada` o `manual` (apertura desde la app, ADR 0035). */
  metodo: 'qr' | 'pulsador' | 'forzada' | 'manual';
  qr_acceso_id: string | null;
  qr_etiqueta: string | null;
  qr_generado_por: string | null;
}

export interface IntentoFila extends RowDataPacket {
  ocurrido_at: Date;
  resultado: 'permitido' | 'rechazado';
  motivo_code: string;
  puerta_id: string;
}

export interface FiltroDeLecturas {
  /** Solo los de QR generados por este usuario y sus propias aperturas manuales; `null` = todos los de la cuenta. */
  readonly generadoPor: string | null;
  /** Solo las de estas puertas (un guardia ve las que tiene asignadas); `null` = todas. */
  readonly puertaIds: readonly string[] | null;
  readonly resultado: 'permitido' | 'rechazado' | null;
  /** Solo los eventos cuya ejecución efectiva es esta (ADR 0031 §18); `null` = todos. */
  readonly ejecucion?: Ejecucion | null;
  readonly puertaId: string | null;
  /** Ventana `[desde, hasta)` en UTC. */
  readonly desde: Date | null;
  readonly hasta: Date | null;
}

export interface ResumenDeEventosFila extends RowDataPacket {
  resultado: 'permitido' | 'rechazado';
  motivo_code: string;
  /** `COUNT(*)` es BIGINT y mysql2 lo entrega como texto (`bigNumberStrings`). */
  total: string;
}

/** Qué pasó con la orden de abrir: la fila de la placa si existe; si no, la constancia del servidor (o nada). */
export const EJECUCION_EFECTIVA =
  '(SELECT c.resultado FROM confirmaciones_apertura AS c WHERE c.evento_acceso_id = t.id AND c.tenant_id = t.tenant_id ' +
  "ORDER BY (c.origen = 'placa') DESC, c.id DESC LIMIT 1)";

function armarFiltroDeEventos(
  filtro: FiltroDeLecturas,
  repeticiones = false,
): { donde?: string; params: unknown[] } {
  // Por omisión solo el primer intento; las repeticiones se cuentan aparte («×N», ADR 0032 §4.2).
  const condiciones: string[] = [
    repeticiones ? 't.repetido_de_id IS NOT NULL' : 't.repetido_de_id IS NULL',
  ];
  const params: unknown[] = [];
  if (filtro.generadoPor !== null) {
    // Quien no ve toda la cuenta ve lo suyo: las lecturas de los QR que generó y sus propias aperturas manuales
    // (ADR 0035 §6; `usuario_id` solo se llena en `manual`). Nunca las manuales de otro usuario.
    condiciones.push("(q.generado_por = ? OR (t.metodo = 'manual' AND t.usuario_id = ?))");
    params.push(filtro.generadoPor, filtro.generadoPor);
  }
  if (filtro.puertaIds !== null) {
    if (filtro.puertaIds.length === 0) {
      condiciones.push('1 = 0');
    } else {
      condiciones.push('t.puerta_id IN (?)');
      params.push(filtro.puertaIds);
    }
  }
  if (filtro.resultado !== null) {
    condiciones.push('t.resultado = ?');
    params.push(filtro.resultado);
  }
  if (filtro.puertaId !== null) {
    condiciones.push('t.puerta_id = ?');
    params.push(filtro.puertaId);
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

export interface NuevaLectura {
  readonly puertaId: string;
  readonly dispositivoId: string;
  readonly qrAccesoId: string | null;
  readonly tokenHash: string;
  readonly resultado: 'permitido' | 'rechazado';
  readonly motivoCode: string;
  readonly ocurridoAt: Date;
  readonly leidoEnDispositivoAt: Date | null;
  /** Id del intento original cuando este es una repetición dentro de la ventana (ADR 0032 §3 y §4). */
  readonly repetidoDeId?: string | null;
}

/** Una petición de apertura manual para dejar en `lecturas` (ADR 0035 §6). */
export interface NuevaLecturaManual {
  readonly puertaId: string;
  readonly usuarioId: string;
  readonly resultado: 'permitido' | 'rechazado';
  readonly motivoCode: string;
  readonly ocurridoAt: Date;
}

/** El intento original que enlaza una repetición. */
export interface OriginalFila extends RowDataPacket {
  id: string;
}

const COLUMNAS_DE_EVENTO =
  't.id, t.ocurrido_at, t.resultado, t.motivo_code, t.puerta_id, t.metodo, t.qr_acceso_id, q.etiqueta AS qr_etiqueta, q.generado_por AS qr_generado_por';

/** Desde cuándo se juzgan las aperturas de un dispositivo. */
export interface DesdeDeDispositivo {
  readonly dispositivoId: string;
  readonly desde: Date;
}

/** Una apertura que el servidor ordenó (un evento `permitido`). */
export interface AperturaOrdenadaFila extends RowDataPacket {
  id: string;
  puerta_id: string;
  dispositivo_id: string;
  ocurrido_at: Date;
}

/** El QR de una unión con `qr_accesos` es de la misma cuenta; no se filtra por `deleted_at` para no perder el historial. */
const UNION_QR = 'LEFT JOIN qr_accesos AS q ON q.id = t.qr_acceso_id AND q.tenant_id = t.tenant_id';

/** Dueño de `lecturas`: solo inserción (invariante 4). */
export class RepositorioDeLecturas extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'lecturas',
      columnas: [
        'puerta_id',
        'dispositivo_id',
        'qr_acceso_id',
        'usuario_id',
        'token_hash',
        'metodo',
        'resultado',
        'motivo_code',
        'ocurrido_at',
        'leido_en_dispositivo_at',
        'repetido_de_id',
      ],
      perfil: 'solo_insercion',
      deCuenta: true,
    });
  }

  /**
   * Una petición de apertura manual desde la app (ADR 0035 §6), aceptada o rechazada: `metodo = 'manual'` y quién
   * la pidió. Sin QR, sin hash de token y SIN dispositivo (al crear la lectura todavía no se sabe qué placa
   * tomará la orden; esa queda en `ordenes_apertura`). No lleva sentido: la app no lo sabe.
   */
  registrarManual(tx: Transaccion, lectura: NuevaLecturaManual): Promise<string> {
    return this.insertar(tx, {
      puerta_id: lectura.puertaId,
      usuario_id: lectura.usuarioId,
      metodo: 'manual',
      resultado: lectura.resultado,
      motivo_code: lectura.motivoCode,
      ocurrido_at: lectura.ocurridoAt,
    });
  }

  registrar(tx: Transaccion, evento: NuevaLectura): Promise<string> {
    return this.insertar(tx, {
      puerta_id: evento.puertaId,
      dispositivo_id: evento.dispositivoId,
      qr_acceso_id: evento.qrAccesoId,
      token_hash: evento.tokenHash,
      metodo: 'qr',
      resultado: evento.resultado,
      motivo_code: evento.motivoCode,
      ocurrido_at: evento.ocurridoAt,
      leido_en_dispositivo_at: evento.leidoEnDispositivoAt,
      repetido_de_id: evento.repetidoDeId ?? null,
    });
  }

  /**
   * El primer intento (nunca una repetición) del MISMO dispositivo, con el MISMO hash de token,
   * resultado y motivo, ocurrido desde `desde`. Es el original al que se enlaza una repetición
   * (ADR 0032 §3 y §4). Solo de la cuenta del contexto; compara por hash, nunca por texto.
   */
  buscarOriginal(
    dispositivoId: string,
    tokenHash: string,
    resultado: 'permitido' | 'rechazado',
    motivoCode: string,
    desde: Date,
  ): Promise<OriginalFila | null> {
    return this.seleccionarUna<OriginalFila>({
      columnas: 't.id',
      donde:
        't.dispositivo_id = ? AND t.token_hash = ? AND t.resultado = ? AND t.motivo_code = ? AND t.repetido_de_id IS NULL AND t.ocurrido_at >= ?',
      params: [dispositivoId, tokenHash, resultado, motivoCode, desde],
      orden: 't.ocurrido_at ASC, t.id ASC',
    });
  }

  /**
   * Cuántas repeticiones tiene cada intento original (ADR 0032 §4.2), separadas por resultado: las
   * `permitidas` abrieron de nuevo la puerta (respuesta perdida) y no deben confundirse con las
   * `rechazadas`. Los originales sin repeticiones no aparecen.
   */
  async contarRepeticiones(
    originalIds: readonly string[],
  ): Promise<Map<string, { permitidas: number; rechazadas: number }>> {
    const mapa = new Map<string, { permitidas: number; rechazadas: number }>();
    if (originalIds.length === 0) return mapa;
    const filas = await this.seleccionar<RowDataPacket>({
      columnas: 't.repetido_de_id AS original_id, t.resultado, COUNT(*) AS total',
      donde: 't.repetido_de_id IN (?)',
      params: [originalIds],
      agrupar: 't.repetido_de_id, t.resultado',
    });
    for (const fila of filas) {
      const id = String(fila.original_id);
      const actual = mapa.get(id) ?? { permitidas: 0, rechazadas: 0 };
      if (fila.resultado === 'permitido') actual.permitidas += Number(fila.total);
      else actual.rechazadas += Number(fila.total);
      mapa.set(id, actual);
    }
    return mapa;
  }

  /**
   * Bloquea la fila del original hasta el fin de la transacción y cuenta las repeticiones PERMITIDAS que
   * ya tiene. El bloqueo serializa las relecturas simultáneas: solo una ve cero y repite la apertura
   * (ADR 0032 §3, una repetición por original).
   */
  async contarRepeticionesPermitidasBloqueando(
    tx: Transaccion,
    originalId: string,
  ): Promise<number> {
    await this.seleccionarUna<OriginalFila>(
      { columnas: 't.id', donde: 't.id = ?', params: [originalId], bloquear: true },
      tx,
    );
    return this.contar(
      { donde: "t.repetido_de_id = ? AND t.resultado = 'permitido'", params: [originalId] },
      tx,
    );
  }

  listar(filtro: FiltroDeLecturas, limite: number, desplazamiento: number): Promise<LecturaFila[]> {
    const { donde, params } = armarFiltroDeEventos(filtro);
    return this.seleccionar<LecturaFila>({
      columnas: COLUMNAS_DE_EVENTO,
      uniones: UNION_QR,
      ...(donde === undefined ? {} : { donde }),
      params,
      orden: 't.ocurrido_at DESC, t.id DESC',
      limite,
      desplazamiento,
    });
  }

  /**
   * Una página para exportar: por id ASCENDENTE, no por fecha. Con el orden del listado (lo más nuevo primero), un
   * intento que llega mientras se descargan las páginas desplaza las filas y se repiten o se pierden; por id
   * creciente, lo nuevo cae siempre al final.
   */
  listarParaExportar(
    filtro: FiltroDeLecturas,
    limite: number,
    desplazamiento: number,
  ): Promise<LecturaFila[]> {
    const { donde, params } = armarFiltroDeEventos(filtro);
    return this.seleccionar<LecturaFila>({
      columnas: COLUMNAS_DE_EVENTO,
      uniones: UNION_QR,
      ...(donde === undefined ? {} : { donde }),
      params,
      orden: 't.id',
      limite,
      desplazamiento,
    });
  }

  /**
   * Cuáles de esos intentos existen en la cuenta del contexto Y leyeron un QR que generó alguno de `generadores`
   * (evidencia de un incidente: del usuario o de su rama). Un intento sin QR no se puede atribuir a nadie: no sirve.
   */
  async existentes(ids: readonly string[], generadores: readonly string[]): Promise<Set<string>> {
    if (ids.length === 0 || generadores.length === 0) return new Set();
    const filas = await this.seleccionar<RowDataPacket>({
      columnas: 't.id',
      uniones: UNION_QR,
      donde: 't.id IN (?) AND q.generado_por IN (?)',
      params: [ids, generadores],
    });
    return new Set(filas.map((fila) => String(fila.id)));
  }

  /**
   * `puertaId -> instante de la última lectura del lector` (aceptada o rechazada) de esas puertas, en la cuenta
   * del contexto. Una puerta sin lecturas no figura. Es lo que distingue una placa en línea pero sin tráfico.
   */
  async ultimaLecturaPorPuertas(puertaIds: readonly string[]): Promise<Map<string, Date>> {
    if (puertaIds.length === 0) return new Map();
    const filas = await this.seleccionar<RowDataPacket>({
      columnas: 't.puerta_id, MAX(t.ocurrido_at) AS ultima',
      donde: "t.puerta_id IN (?) AND t.metodo = 'qr'",
      params: [puertaIds],
      agrupar: 't.puerta_id',
    });
    return new Map(filas.map((fila) => [String(fila.puerta_id), fila.ultima as Date]));
  }

  /** El intento más reciente sobre un QR (aceptado o rechazado), o `null` si nadie lo leyó. */
  ultimoDeQr(qrId: string): Promise<IntentoFila | null> {
    return this.seleccionarUna<IntentoFila>({
      columnas: 't.ocurrido_at, t.resultado, t.motivo_code, t.puerta_id',
      donde: 't.qr_acceso_id = ?',
      params: [qrId],
      orden: 't.ocurrido_at DESC, t.id DESC',
    });
  }

  /** Un evento PERMITIDO de este dispositivo (el que ordenó una apertura), o `null`. Sin bloqueo. */
  buscarAperturaDelDispositivo(
    id: string,
    dispositivoId: string,
  ): Promise<AperturaOrdenadaFila | null> {
    return this.seleccionarUna<AperturaOrdenadaFila>({
      columnas: 't.id, t.puerta_id, t.dispositivo_id, t.ocurrido_at',
      donde: "t.id = ? AND t.dispositivo_id = ? AND t.resultado = 'permitido' AND t.metodo = 'qr'",
      params: [id, dispositivoId],
    });
  }

  /** Un evento visible de la cuenta, para el detalle (el alcance lo pone el filtro). */
  buscarVisible(filtro: FiltroDeLecturas, id: string): Promise<LecturaFila | null> {
    const { donde, params } = armarFiltroDeEventos(filtro);
    return this.seleccionarUna<LecturaFila>({
      columnas: COLUMNAS_DE_EVENTO,
      uniones: UNION_QR,
      donde: donde === undefined ? 't.id = ?' : donde + ' AND t.id = ?',
      params: [...params, id],
    });
  }

  /**
   * Las aperturas ordenadas (eventos permitidos por QR) de cada dispositivo desde SU instante `desde` (incl.) y hasta
   * `hasta` (excl.) de las que nadie informó nada: ni la placa ni el servidor. `desde` es por dispositivo porque cada
   * uno empieza a juzgarse cuando se le habilitó el sensor. Las más viejas primero; sin bloqueo (lectura del detector).
   */
  aperturasSinInforme(
    dispositivos: readonly DesdeDeDispositivo[],
    hasta: Date,
    limite: number,
  ): Promise<AperturaOrdenadaFila[]> {
    if (dispositivos.length === 0) return Promise.resolve([]);
    // Un par (dispositivo, desde) por cada uno; solo `?`, nunca un valor en el texto del SQL.
    const porDispositivo = dispositivos
      .map(() => '(t.dispositivo_id = ? AND t.ocurrido_at >= ?)')
      .join(' OR ');
    return this.seleccionar<AperturaOrdenadaFila>({
      columnas: 't.id, t.puerta_id, t.dispositivo_id, t.ocurrido_at',
      uniones:
        'LEFT JOIN confirmaciones_apertura AS c ON c.evento_acceso_id = t.id AND c.tenant_id = t.tenant_id',
      donde: `t.resultado = 'permitido' AND t.metodo = 'qr' AND t.ocurrido_at < ? AND c.id IS NULL AND (${porDispositivo})`,
      params: [hasta, ...dispositivos.flatMap((d) => [d.dispositivoId, d.desde])],
      orden: 't.ocurrido_at, t.id',
      limite,
    });
  }

  contarVisibles(filtro: FiltroDeLecturas): Promise<number> {
    const { donde, params } = armarFiltroDeEventos(filtro);
    return this.contar({ uniones: UNION_QR, ...(donde === undefined ? {} : { donde }), params });
  }

  /**
   * Cuántos intentos hubo por resultado y motivo dentro del filtro (indicadores del tablero). Los
   * originales cuentan una vez; las repeticiones se suman aparte (`repeticiones_*`): las permitidas
   * son aperturas repetidas por respuesta perdida y no son invisibles.
   */
  resumir(filtro: FiltroDeLecturas): Promise<ResumenDeEventosFila[]> {
    const { donde, params } = armarFiltroDeEventos(filtro);
    return this.seleccionar<ResumenDeEventosFila>({
      columnas: 't.resultado, t.motivo_code, COUNT(*) AS total',
      uniones: UNION_QR,
      ...(donde === undefined ? {} : { donde }),
      params,
      agrupar: 't.resultado, t.motivo_code',
      orden: 't.resultado, t.motivo_code',
    });
  }

  /**
   * Cuántas repeticiones (filas con `repetido_de_id`) hubo por resultado dentro del filtro: las
   * `permitido` son aperturas repetidas por respuesta perdida (ADR 0032 §3) y no deben quedar invisibles.
   */
  resumirRepeticiones(filtro: FiltroDeLecturas): Promise<ResumenDeEventosFila[]> {
    const { donde, params } = armarFiltroDeEventos(filtro, true);
    return this.seleccionar<ResumenDeEventosFila>({
      columnas: "t.resultado, '' AS motivo_code, COUNT(*) AS total",
      uniones: UNION_QR,
      ...(donde === undefined ? {} : { donde }),
      params,
      agrupar: 't.resultado',
    });
  }
}

export interface ConfirmacionFila extends RowDataPacket {
  id: string;
  evento_acceso_id: string;
  dispositivo_id: string;
  puerta_id: string;
  origen: OrigenDeConfirmacion;
  resultado: Ejecucion;
  causa: CausaDeEjecucion;
  registrada_at: Date;
}

/** Una fila de confirmación con la hora de la orden de abrir a la que se refiere. */
export interface ConfirmacionConOrdenFila extends ConfirmacionFila {
  ocurrido_at: Date;
}

export interface NuevaConfirmacion {
  readonly eventoId: string;
  readonly dispositivoId: string;
  readonly puertaId: string;
  readonly origen: OrigenDeConfirmacion;
  readonly resultado: Ejecucion;
  readonly causa: CausaDeEjecucion;
  readonly reportadoEnDispositivoAt: Date | null;
  readonly registradaAt: Date;
}

const COLUMNAS_DE_CONFIRMACION =
  't.id, t.evento_acceso_id, t.dispositivo_id, t.puerta_id, t.origen, t.resultado, t.causa, t.registrada_at';

/** Dueño de `confirmaciones_apertura`: solo inserción (se enlaza a `lecturas`, invariante 4). */
export class RepositorioDeConfirmaciones extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'confirmaciones_apertura',
      columnas: [
        'evento_acceso_id',
        'dispositivo_id',
        'puerta_id',
        'origen',
        'resultado',
        'causa',
        'reportado_en_dispositivo_at',
        'registrada_at',
      ],
      perfil: 'solo_insercion',
      deCuenta: true,
    });
  }

  /**
   * Inserta si el evento aún no tiene una fila de ese origen. Idempotente: repetir el informe (o competir con
   * otra pasada) devuelve `null` y no crea nada. Devuelve el id de la fila nueva.
   */
  async registrar(tx: Transaccion, confirmacion: NuevaConfirmacion): Promise<string | null> {
    const previa = await this.seleccionarUna<ConfirmacionFila>(
      {
        columnas: COLUMNAS_DE_CONFIRMACION,
        donde: 't.evento_acceso_id = ? AND t.origen = ?',
        params: [confirmacion.eventoId, confirmacion.origen],
      },
      tx,
    );
    if (previa !== null) return null;
    try {
      return await this.insertar(tx, {
        evento_acceso_id: confirmacion.eventoId,
        dispositivo_id: confirmacion.dispositivoId,
        puerta_id: confirmacion.puertaId,
        origen: confirmacion.origen,
        resultado: confirmacion.resultado,
        causa: confirmacion.causa,
        reportado_en_dispositivo_at: confirmacion.reportadoEnDispositivoAt,
        registrada_at: confirmacion.registradaAt,
      });
    } catch (error) {
      // Otra petición la insertó entre la lectura y el INSERT: el índice único hizo su trabajo.
      if (esEntradaDuplicada(error)) return null;
      throw error;
    }
  }

  /** ¿La placa ya informó sobre esta apertura? */
  async yaInformo(eventoId: string): Promise<boolean> {
    return (
      (await this.seleccionarUna<ConfirmacionFila>({
        columnas: COLUMNAS_DE_CONFIRMACION,
        donde: "t.evento_acceso_id = ? AND t.origen = 'placa'",
        params: [eventoId],
      })) !== null
    );
  }

  /** Todas las filas de esos eventos (la de la placa y la del servidor), de la más vieja a la más nueva. */
  deEventos(eventoIds: readonly string[]): Promise<ConfirmacionFila[]> {
    if (eventoIds.length === 0) return Promise.resolve([]);
    return this.seleccionar<ConfirmacionFila>({
      columnas: COLUMNAS_DE_CONFIRMACION,
      donde: 't.evento_acceso_id IN (?)',
      params: [eventoIds],
      orden: 't.id',
    });
  }

  /** Las filas registradas desde `desde`, de la cuenta del contexto, para que el detector juzgue (sin bloqueo). */
  registradasDesde(desde: Date, limite: number): Promise<ConfirmacionConOrdenFila[]> {
    return this.seleccionar<ConfirmacionConOrdenFila>({
      columnas: COLUMNAS_DE_CONFIRMACION + ', e.ocurrido_at',
      uniones: 'JOIN lecturas AS e ON e.id = t.evento_acceso_id AND e.tenant_id = t.tenant_id',
      donde: 't.registrada_at >= ?',
      params: [desde],
      orden: 't.id',
      limite,
    });
  }
}

/** ¿Un `ER_DUP_ENTRY` de MySQL/MariaDB? */
function esEntradaDuplicada(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY'
  );
}

/** Lee las confirmaciones de TODAS las cuentas por id de evento (listado del panel de plataforma). Solo lectura. */
export class RepositorioDeConfirmacionesDeTodas extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'confirmaciones_apertura',
      columnas: [],
      perfil: 'solo_insercion',
      deCuenta: true,
    });
  }

  deEventos(eventoIds: readonly string[]): Promise<ConfirmacionFila[]> {
    if (eventoIds.length === 0) return Promise.resolve([]);
    return this.seleccionar<ConfirmacionFila>({
      columnas: COLUMNAS_DE_CONFIRMACION,
      donde: 't.evento_acceso_id IN (?)',
      params: [eventoIds],
      orden: 't.id',
    });
  }
}

/** Dueño de `anulaciones_masivas`: el motivo y el alcance de cada anulación en bloque (ADR 0031 §3). */
export class RepositorioDeAnulacionesMasivas extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'anulaciones_masivas',
      columnas: ['alcance', 'usuario_objetivo_id', 'motivo', 'usuarios_alcanzados', 'qr_anulados'],
      perfil: 'dominio',
      deCuenta: true,
    });
  }

  registrar(
    tx: Transaccion,
    anulacion: {
      readonly alcance: 'usuario' | 'rama' | 'cuenta';
      readonly usuarioObjetivoId: string | null;
      readonly motivo: string;
      readonly usuariosAlcanzados: number;
      readonly qrAnulados: number;
    },
  ): Promise<string> {
    return this.insertar(tx, {
      alcance: anulacion.alcance,
      usuario_objetivo_id: anulacion.usuarioObjetivoId,
      motivo: anulacion.motivo,
      usuarios_alcanzados: anulacion.usuariosAlcanzados,
      qr_anulados: anulacion.qrAnulados,
    });
  }
}

/** Dueño de `exportaciones`: la constancia de cada página de datos que la cuenta descargó (ADR 0033 §3). */
export class RepositorioDeExportaciones extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'exportaciones',
      columnas: ['recurso', 'pagina', 'por_pagina', 'filas', 'filtros'],
      perfil: 'dominio',
      deCuenta: true,
    });
  }

  registrar(
    tx: Transaccion,
    exportacion: {
      readonly recurso: 'usuarios' | 'puertas' | 'lecturas';
      readonly pagina: number;
      readonly porPagina: number;
      readonly filas: number;
      readonly filtros: Readonly<Record<string, unknown>> | null;
    },
  ): Promise<string> {
    return this.insertar(tx, {
      recurso: exportacion.recurso,
      pagina: exportacion.pagina,
      por_pagina: exportacion.porPagina,
      filas: exportacion.filas,
      filtros: exportacion.filtros === null ? null : JSON.stringify(exportacion.filtros),
    });
  }
}

/** Un usuario con muchas aperturas con su QR propio, o con usos imposibles, en una ventana. */
export interface ActividadSospechosaFila extends RowDataPacket {
  tenant_id: string;
  usuario_id: string;
  total: number | string;
  /** Los ids de los últimos intentos (más nuevos primero), separados por coma. */
  ids: string;
  /** Solo en los usos imposibles: los ids de la otra mitad de cada par. */
  ids_destino?: string | null;
}

/** Un QR cuyo rechazo `qr.usado` se repite. */
export interface QrReenviadoFila extends RowDataPacket {
  tenant_id: string;
  usuario_id: string;
  qr_id: string;
  rechazos: number | string;
  /** De los rechazos, los intentos distintos (`repetido_de_id IS NULL`). */
  intentos: number | string;
  lectores: number | string;
  ids: string;
}

export interface AperturasDeCuentaFila extends RowDataPacket {
  tenant_id: string;
  aperturas: number | string;
}

export interface ActividadPorDiaFila extends RowDataPacket {
  tenant_id: string;
  dia: string;
  aperturas: number | string;
  rechazos: number | string;
}

export interface GeneradosPorDiaFila extends RowDataPacket {
  tenant_id: string;
  dia: string;
  generados: number | string;
}

/** Una apertura por QR propio, como la lee el emparejador de usos imposibles. */
interface AperturaPropiaFila extends RowDataPacket {
  id: string;
  usuario_id: string;
  puerta_id: string;
  sitio_id: string;
  ocurrido_at: Date;
}

/**
 * Cuenta los pares imposibles de UN usuario. `aperturas` viene ordenada por (hora, id). Dos aperturas A y B forman un
 * par si B es posterior (`id` mayor y hora no anterior), en otra puerta, y la diferencia cabe en el umbral de sitios
 * (sitios distintos) o de puertas (mismo sitio; 0 = no se juzga). Como el orden es por hora, se corta en cuanto la
 * diferencia pasa del mayor umbral. Devuelve `null` si no hay ningún par.
 */
function emparejarUsosImposibles(
  cuentaId: string,
  usuarioId: string,
  aperturas: readonly AperturaPropiaFila[],
  entreSitiosSegundos: number,
  entrePuertasSegundos: number,
  maximoDeIds: number,
): ActividadSospechosaFila | null {
  const cotaMs = Math.max(entreSitiosSegundos, entrePuertasSegundos, 0) * 1000;
  let total = 0;
  const origenes = new Set<bigint>();
  const destinos = new Set<bigint>();
  aperturas.forEach((a, i) => {
    const horaA = a.ocurrido_at.getTime();
    for (let j = i + 1; j < aperturas.length; j++) {
      const b = aperturas[j];
      if (b === undefined) break;
      const diferenciaMs = b.ocurrido_at.getTime() - horaA;
      if (diferenciaMs > cotaMs) break;
      if (b.puerta_id === a.puerta_id || BigInt(b.id) <= BigInt(a.id)) continue;
      const mismoSitio = b.sitio_id === a.sitio_id;
      const umbralMs = (mismoSitio ? entrePuertasSegundos : entreSitiosSegundos) * 1000;
      // Con 0 en el mismo sitio no se juzga: el umbral queda en 0 y solo una diferencia exacta de 0 s contaría.
      if (mismoSitio && entrePuertasSegundos <= 0) continue;
      if (diferenciaMs > umbralMs) continue;
      total++;
      origenes.add(BigInt(a.id));
      destinos.add(BigInt(b.id));
    }
  });
  if (total === 0) return null;
  const masNuevos = (ids: Set<bigint>) =>
    [...ids]
      .sort((x, y) => (x < y ? 1 : x > y ? -1 : 0))
      .slice(0, maximoDeIds)
      .join(',');
  return {
    tenant_id: cuentaId,
    usuario_id: usuarioId,
    total,
    ids: masNuevos(origenes),
    ids_destino: masNuevos(destinos),
  } as ActividadSospechosaFila;
}

/**
 * Solo las aperturas que ordenó el servidor por QR: el pulsador y la llave no cuentan para estas señales. Y solo
 * aperturas DISTINTAS: una relectura enlazada (`repetido_de_id` no nulo, respuesta perdida, ADR 0032 §3) abre la
 * puerta de nuevo pero es la misma apertura y no debe inflar el uso masivo, el flujo ni el emparejamiento de usos.
 */
const ES_APERTURA_POR_QR =
  "t.metodo = 'qr' AND t.resultado = 'permitido' AND t.repetido_de_id IS NULL";

/**
 * Lee `lecturas` de TODAS las cuentas para los detectores de señales y la vista de AGROCOM (ADR 0030 §4 y §5,
 * ola W12): salto EXPLÍCITO del aislamiento, de solo lectura (la tabla es de solo inserción). Cada hallazgo se trata
 * luego dentro de su cuenta. Las aperturas se cuentan DISTINTAS (sin las repeticiones de un mismo intento, ADR 0032
 * §4.3); en los rechazos de un QR reenviado las repeticiones sí hacen volumen.
 */
export class RepositorioDeActividadDeTodas extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'lecturas',
      columnas: [],
      perfil: 'solo_insercion',
      deCuenta: true,
    });
  }

  /** Usuarios con al menos `minimo` aperturas con un QR propio suyo entre `desde` y `hasta` (ambos incl.). */
  aperturasPropias(
    desde: Date,
    hasta: Date,
    minimo: number,
    limite: number,
    despuesDe: { readonly cuentaId: string; readonly usuarioId: string } | null,
  ): Promise<ActividadSospechosaFila[]> {
    const cursor = despuesDe === null ? [] : [despuesDe.cuentaId, despuesDe.usuarioId];
    return this.seleccionar<ActividadSospechosaFila>({
      columnas:
        't.tenant_id, q.generado_por AS usuario_id, COUNT(*) AS total, ' +
        "SUBSTRING_INDEX(GROUP_CONCAT(t.id ORDER BY t.id DESC SEPARATOR ','), ',', 50) AS ids",
      uniones:
        'JOIN qr_accesos AS q ON q.id = t.qr_acceso_id AND q.tenant_id = t.tenant_id AND q.es_propio = 1',
      donde:
        `${ES_APERTURA_POR_QR} AND t.ocurrido_at >= ? AND t.ocurrido_at <= ?` +
        (despuesDe === null ? '' : ' AND (t.tenant_id, q.generado_por) > (?, ?)'),
      // El último `?` es el del HAVING: la consulta junta los parámetros en el orden del texto.
      params: [desde, hasta, ...cursor, minimo],
      agrupar: 't.tenant_id, q.generado_por HAVING COUNT(*) >= ?',
      orden: 't.tenant_id, q.generado_por',
      limite,
    });
  }

  /**
   * Usuarios con al menos un par de usos de su QR propio que no alcanzan a recorrerse: en SITIOS distintos con
   * menos de `entreSitiosSegundos` de diferencia, o en PUERTAS distintas del MISMO sitio con menos de
   * `entrePuertasSegundos` (0 = no se juzga el mismo sitio). Solo datos que ya existen: no hay distancias entre
   * sitios, así que el tiempo mínimo es un umbral configurado, no un cálculo de recorrido.
   *
   * Se evalúa CUENTA POR CUENTA y los pares se emparejan en memoria, ordenados por hora: un self-join de
   * `lecturas` (MariaDB no logra acotar su rango por fila con `(tenant_id, ocurrido_at)`) era cuadrático en los
   * eventos de la cuenta. Aquí cada cuenta cuesta una lectura por índice de su ventana y, por usuario, solo se
   * comparan las aperturas a menos de `max(umbrales)` segundos; ninguna página rehace las cuentas ya recorridas.
   * Un par es (A, B) con B posterior a A (`id` y hora), en otra puerta, y ambos dentro de `desde`..`hasta`.
   */
  async usosImposibles(
    desde: Date,
    hasta: Date,
    entreSitiosSegundos: number,
    entrePuertasSegundos: number,
    limite: number,
    despuesDe: { readonly cuentaId: string; readonly usuarioId: string } | null,
  ): Promise<ActividadSospechosaFila[]> {
    const MAXIMO_DE_IDS = 25;
    // Cuentas con al menos dos aperturas por QR propio en la ventana (sin dos no hay par), desde la del cursor.
    const cuentas = await this.seleccionar<RowDataPacket>({
      columnas: 't.tenant_id',
      uniones:
        'JOIN qr_accesos AS q ON q.id = t.qr_acceso_id AND q.tenant_id = t.tenant_id AND q.es_propio = 1',
      donde:
        `${ES_APERTURA_POR_QR} AND t.ocurrido_at >= ? AND t.ocurrido_at <= ?` +
        (despuesDe === null ? '' : ' AND t.tenant_id >= ?'),
      params: [desde, hasta, ...(despuesDe === null ? [] : [despuesDe.cuentaId]), 2],
      agrupar: 't.tenant_id HAVING COUNT(*) >= ?',
      orden: 't.tenant_id',
    });

    const hallazgos: ActividadSospechosaFila[] = [];
    for (const { tenant_id: cuentaId } of cuentas as { tenant_id: string }[]) {
      const aperturas = await this.seleccionar<AperturaPropiaFila>({
        columnas:
          't.id, q.generado_por AS usuario_id, t.puerta_id, p.sitio_id, ' +
          't.ocurrido_at AS ocurrido_at',
        uniones:
          'JOIN qr_accesos AS q ON q.id = t.qr_acceso_id AND q.tenant_id = t.tenant_id AND q.es_propio = 1 ' +
          'JOIN puertas AS p ON p.id = t.puerta_id AND p.tenant_id = t.tenant_id',
        donde: `${ES_APERTURA_POR_QR} AND t.tenant_id = ? AND t.ocurrido_at >= ? AND t.ocurrido_at <= ?`,
        params: [cuentaId, desde, hasta],
        orden: 'q.generado_por, t.ocurrido_at, t.id',
      });
      let inicio = 0;
      while (inicio < aperturas.length) {
        const usuarioId = String(aperturas[inicio]?.usuario_id);
        let fin = inicio;
        while (fin < aperturas.length && String(aperturas[fin]?.usuario_id) === usuarioId) fin++;
        const esDespues =
          despuesDe === null ||
          BigInt(cuentaId) > BigInt(despuesDe.cuentaId) ||
          BigInt(usuarioId) > BigInt(despuesDe.usuarioId);
        if (esDespues) {
          const hallazgo = emparejarUsosImposibles(
            cuentaId,
            usuarioId,
            aperturas.slice(inicio, fin),
            entreSitiosSegundos,
            entrePuertasSegundos,
            MAXIMO_DE_IDS,
          );
          if (hallazgo !== null) hallazgos.push(hallazgo);
          if (hallazgos.length >= limite) return hallazgos;
        }
        inicio = fin;
      }
    }
    return hallazgos;
  }

  /**
   * QR con al menos `minimo` rechazos `qr.usado` entre `desde` y `hasta` CONTANDO TODAS las filas (el volumen: las
   * repeticiones de un mismo intento incluidas), con cuántos son intentos distintos (`repetido_de_id IS NULL`), cuántos
   * lectores distintos tuvieron un intento distinto y quién generó el QR. Ordenados por (cuenta, generador, QR).
   */
  qrReenviados(
    desde: Date,
    hasta: Date,
    minimo: number,
    limite: number,
    despuesDe: {
      readonly cuentaId: string;
      readonly usuarioId: string;
      readonly qrId: string;
    } | null,
  ): Promise<QrReenviadoFila[]> {
    const cursor =
      despuesDe === null ? [] : [despuesDe.cuentaId, despuesDe.usuarioId, despuesDe.qrId];
    return this.seleccionar<QrReenviadoFila>({
      columnas:
        't.tenant_id, q.generado_por AS usuario_id, t.qr_acceso_id AS qr_id, COUNT(*) AS rechazos, ' +
        'SUM(t.repetido_de_id IS NULL) AS intentos, ' +
        'COUNT(DISTINCT IF(t.repetido_de_id IS NULL, t.dispositivo_id, NULL)) AS lectores, ' +
        "SUBSTRING_INDEX(GROUP_CONCAT(t.id ORDER BY t.id DESC SEPARATOR ','), ',', 20) AS ids",
      uniones: 'JOIN qr_accesos AS q ON q.id = t.qr_acceso_id AND q.tenant_id = t.tenant_id',
      donde:
        "t.motivo_code = 'qr.usado' AND t.ocurrido_at >= ? AND t.ocurrido_at <= ?" +
        (despuesDe === null
          ? ''
          : ' AND (t.tenant_id, q.generado_por, t.qr_acceso_id) > (?, ?, ?)'),
      params: [desde, hasta, ...cursor, minimo],
      agrupar: 't.tenant_id, q.generado_por, t.qr_acceso_id HAVING COUNT(*) >= ?',
      orden: 't.tenant_id, q.generado_por, t.qr_acceso_id',
      limite,
    });
  }

  /** Cuentas con al menos `minimo` aperturas por QR entre `desde` y `hasta`, por id, a continuación de `despuesDe`. */
  cuentasConAperturas(
    desde: Date,
    hasta: Date,
    minimo: number,
    limite: number,
    despuesDe: string | null,
  ): Promise<AperturasDeCuentaFila[]> {
    return this.seleccionar<AperturasDeCuentaFila>({
      columnas: 't.tenant_id, COUNT(*) AS aperturas',
      donde:
        `${ES_APERTURA_POR_QR} AND t.ocurrido_at >= ? AND t.ocurrido_at <= ?` +
        (despuesDe === null ? '' : ' AND t.tenant_id > ?'),
      params: [desde, hasta, ...(despuesDe === null ? [] : [despuesDe]), minimo],
      agrupar: 't.tenant_id HAVING COUNT(*) >= ?',
      orden: 't.tenant_id',
      limite,
    });
  }

  /**
   * Aperturas por QR y rechazos por día local de esas cuentas entre `desde` (incl.) y `hasta` (excl.). El día se corta
   * con `desfaseUtc` (`-04:00`: La Paz), una constante del código que va como parámetro. Los días sin intentos no figuran.
   */
  porDia(
    cuentaIds: readonly string[],
    desde: Date,
    hasta: Date,
    desfaseUtc: string,
  ): Promise<ActividadPorDiaFila[]> {
    if (cuentaIds.length === 0) return Promise.resolve([]);
    return this.seleccionar<ActividadPorDiaFila>({
      columnas:
        "t.tenant_id, DATE_FORMAT(CONVERT_TZ(t.ocurrido_at, '+00:00', ?), '%Y-%m-%d') AS dia, " +
        `SUM(${ES_APERTURA_POR_QR}) AS aperturas, SUM(t.resultado = 'rechazado' AND t.repetido_de_id IS NULL) AS rechazos`,
      donde: 't.tenant_id IN (?) AND t.ocurrido_at >= ? AND t.ocurrido_at < ?',
      params: [desfaseUtc, cuentaIds, desde, hasta],
      agrupar: 't.tenant_id, dia',
      orden: 't.tenant_id, dia',
    });
  }
}

/** Lee `qr_accesos` de TODAS las cuentas, solo para el consumo de la bolsa y el flujo que ve AGROCOM (ola W12). */
export class RepositorioDeQrDeTodas extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'qr_accesos',
      columnas: [],
      perfil: 'dominio',
      deCuenta: true,
    });
  }

  /** `cuentaId -> QR generados` entre `desde` (incl.) y `hasta` (excl.): lo que consume de su bolsa mensual. */
  async generadosPorCuenta(
    cuentaIds: readonly string[],
    desde: Date,
    hasta: Date,
  ): Promise<Map<string, number>> {
    const mapa = new Map<string, number>();
    if (cuentaIds.length === 0) return mapa;
    const filas = await this.seleccionar<RowDataPacket>({
      columnas: 't.tenant_id, COUNT(*) AS total',
      donde: 't.tenant_id IN (?) AND t.created_at >= ? AND t.created_at < ?',
      params: [cuentaIds, desde, hasta],
      agrupar: 't.tenant_id',
    });
    for (const fila of filas) mapa.set(String(fila.tenant_id), Number(fila.total));
    return mapa;
  }

  /** QR generados por día local de esas cuentas entre `desde` (incl.) y `hasta` (excl.). */
  generadosPorDia(
    cuentaIds: readonly string[],
    desde: Date,
    hasta: Date,
    desfaseUtc: string,
  ): Promise<GeneradosPorDiaFila[]> {
    if (cuentaIds.length === 0) return Promise.resolve([]);
    return this.seleccionar<GeneradosPorDiaFila>({
      columnas:
        "t.tenant_id, DATE_FORMAT(CONVERT_TZ(t.created_at, '+00:00', ?), '%Y-%m-%d') AS dia, COUNT(*) AS generados",
      donde: 't.tenant_id IN (?) AND t.created_at >= ? AND t.created_at < ?',
      params: [desfaseUtc, cuentaIds, desde, hasta],
      agrupar: 't.tenant_id, dia',
      orden: 't.tenant_id, dia',
    });
  }
}

/** Una clave de idempotencia vigente y la respuesta que se dio la primera vez. */
export interface ClaveDeIdempotencia {
  readonly huella: string;
  /** La respuesta sin el token del QR (nunca se guarda). */
  readonly respuesta: unknown;
  /** Cuándo se creó la clave (ver `NuevaClaveDeIdempotencia.creadaAt`). */
  readonly creadaAt: Date;
}

export interface NuevaClaveDeIdempotencia extends Omit<ClaveDeIdempotencia, 'creadaAt'> {
  readonly usuarioId: string;
  readonly operacion: OperacionIdempotente;
  readonly claveHash: string;
  /** Cuándo se creó: entra en la derivación del token, así una clave reusada tras vencer da otro token. */
  readonly creadaAt: Date;
  readonly venceAt: Date;
}

interface ClaveDeIdempotenciaFila extends RowDataPacket {
  huella: string;
  respuesta: unknown;
  created_at: Date;
}

/**
 * Dueño de `claves_idempotencia` (ADR 0031 §11). Tabla transitoria de una cuenta: toda lectura y escritura
 * lleva la cuenta del contexto y el usuario, de modo que una clave nunca cruza usuarios ni cuentas.
 */
export class RepositorioDeClavesDeIdempotencia extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'claves_idempotencia',
      columnas: [
        'usuario_id',
        'operacion',
        'clave_hash',
        'huella',
        'respuesta',
        'created_at',
        'vence_at',
      ],
      sensibles: ['clave_hash'],
      perfil: 'transitoria',
      deCuenta: true,
    });
  }

  /**
   * La clave vigente (no vencida) del usuario, o `null`. Dentro de la transacción de la generación se llama
   * ya con el usuario bloqueado (`estadoEfectivoBloqueando`): otra generación suya con la misma clave espera
   * ese bloqueo y, al seguir, esta lectura ya ve su fila confirmada. Sin bloqueo propio a propósito: un
   * `FOR UPDATE` sobre una fila inexistente toma bloqueos de hueco que se estorban entre usuarios.
   */
  async buscar(
    usuarioId: string,
    operacion: OperacionIdempotente,
    claveHash: string,
    ahora: Date,
    tx?: Transaccion,
  ): Promise<ClaveDeIdempotencia | null> {
    const fila = await this.seleccionarUna<ClaveDeIdempotenciaFila>(
      {
        columnas: 't.huella, t.respuesta, t.created_at',
        donde: 't.usuario_id = ? AND t.operacion = ? AND t.clave_hash = ? AND t.vence_at > ?',
        params: [usuarioId, operacion, claveHash, ahora],
      },
      tx,
    );
    if (fila === null) return null;
    return {
      huella: fila.huella,
      // MariaDB devuelve el JSON como texto.
      respuesta: typeof fila.respuesta === 'string' ? JSON.parse(fila.respuesta) : fila.respuesta,
      creadaAt: fila.created_at,
    };
  }

  /**
   * Guarda la clave en la misma transacción que el QR (o ambos o ninguno). Antes borra las claves vencidas del
   * usuario: es la limpieza que acompaña a cada escritura (el resto lo barre `purgarVencidas`) y deja libre la
   * fila de la misma clave si había vencido. Excepción a la invariante 8 (DELETE físico): es un caché con
   * vencimiento, no un dato de dominio.
   */
  async guardar(tx: Transaccion, clave: NuevaClaveDeIdempotencia, ahora: Date): Promise<void> {
    const alcance = this.alcance().condicion(null);
    await tx.query(
      // eslint-disable-next-line no-restricted-syntax -- el alcance de cuenta es un fragmento interno con `?`; los valores van aparte.
      `DELETE FROM claves_idempotencia WHERE ${alcance.sql} AND usuario_id = ? AND vence_at <= ?`,
      [...alcance.params, clave.usuarioId, ahora],
    );
    await this.insertar(tx, {
      usuario_id: clave.usuarioId,
      operacion: clave.operacion,
      clave_hash: clave.claveHash,
      huella: clave.huella,
      respuesta: JSON.stringify(clave.respuesta),
      created_at: clave.creadaAt,
      vence_at: clave.venceAt,
    });
  }
}

/**
 * Barrido de mantenimiento de TODAS las cuentas: borra las claves vencidas, en lotes. Es el único acceso a una
 * tabla de cuenta sin su contexto, y es legítimo porque no lee ni devuelve ningún dato de una cuenta: solo
 * descarta filas cuyo vencimiento ya pasó (revisar línea por línea, invariante 1).
 */
export async function purgarClavesDeIdempotenciaVencidas(
  pool: Pool,
  ahora: Date,
  lote = 1000,
): Promise<number> {
  let total = 0;
  for (;;) {
    const [resultado] = await pool.query<ResultSetHeader>(
      'DELETE FROM claves_idempotencia WHERE vence_at <= ? LIMIT ?',
      [ahora, lote],
    );
    total += resultado.affectedRows;
    if (resultado.affectedRows < lote) return total;
  }
}
