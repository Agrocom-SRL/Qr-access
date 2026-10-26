import type { Pool, RowDataPacket } from 'mysql2/promise';
import { RepositorioDeCuenta } from '../../platform/db/repositorio-de-cuenta.js';
import type { Transaccion } from '../../platform/db/transaccion.js';
import type { EstadoDeQr } from './domain/estado-qr.js';

export interface QrFila extends RowDataPacket {
  id: string;
  generado_por: string;
  etiqueta: string | null;
  vence_at: Date;
  usado_at: Date | null;
  anulado_at: Date | null;
  created_at: Date;
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

  /** `qrId -> ids de puerta`, en el orden en que se asociaron. */
  async puertasDe(qrIds: readonly string[]): Promise<Map<string, string[]>> {
    const mapa = new Map<string, string[]>();
    if (qrIds.length === 0) return mapa;
    const filas = await this.seleccionar<PuertaDeQrFila>({
      columnas: 't.qr_acceso_id, t.puerta_id',
      donde: 't.qr_acceso_id IN (?)',
      params: [qrIds],
      orden: 't.id',
    });
    for (const fila of filas) {
      mapa.set(fila.qr_acceso_id, [...(mapa.get(fila.qr_acceso_id) ?? []), fila.puerta_id]);
    }
    return mapa;
  }
}

export interface EventoFila extends RowDataPacket {
  id: string;
  ocurrido_at: Date;
  resultado: 'permitido' | 'rechazado';
  motivo_code: string;
  puerta_id: string;
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

export interface FiltroDeEventos {
  /** Solo los de QR generados por este usuario; `null` = todos los de la cuenta. */
  readonly generadoPor: string | null;
  /** Solo las de estas puertas (un guardia ve las que tiene asignadas); `null` = todas. */
  readonly puertaIds: readonly string[] | null;
  readonly resultado: 'permitido' | 'rechazado' | null;
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

function armarFiltroDeEventos(filtro: FiltroDeEventos): { donde?: string; params: unknown[] } {
  const condiciones: string[] = [];
  const params: unknown[] = [];
  if (filtro.generadoPor !== null) {
    condiciones.push('q.generado_por = ?');
    params.push(filtro.generadoPor);
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

export interface NuevoEvento {
  readonly puertaId: string;
  readonly dispositivoId: string;
  readonly qrAccesoId: string | null;
  readonly tokenHash: string;
  readonly resultado: 'permitido' | 'rechazado';
  readonly motivoCode: string;
  readonly ocurridoAt: Date;
  readonly leidoEnDispositivoAt: Date | null;
}

/** El QR de una unión con `qr_accesos` es de la misma cuenta; no se filtra por `deleted_at` para no perder el historial. */
const UNION_QR = 'LEFT JOIN qr_accesos AS q ON q.id = t.qr_acceso_id AND q.tenant_id = t.tenant_id';

/** Dueño de `eventos_acceso`: solo inserción (invariante 4). */
export class RepositorioDeEventos extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'eventos_acceso',
      columnas: [
        'puerta_id',
        'dispositivo_id',
        'qr_acceso_id',
        'token_hash',
        'metodo',
        'resultado',
        'motivo_code',
        'ocurrido_at',
        'leido_en_dispositivo_at',
      ],
      perfil: 'solo_insercion',
      deCuenta: true,
    });
  }

  registrar(tx: Transaccion, evento: NuevoEvento): Promise<string> {
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
    });
  }

  listar(filtro: FiltroDeEventos, limite: number, desplazamiento: number): Promise<EventoFila[]> {
    const { donde, params } = armarFiltroDeEventos(filtro);
    return this.seleccionar<EventoFila>({
      columnas:
        't.id, t.ocurrido_at, t.resultado, t.motivo_code, t.puerta_id, t.qr_acceso_id, q.etiqueta AS qr_etiqueta, q.generado_por AS qr_generado_por',
      uniones: UNION_QR,
      ...(donde === undefined ? {} : { donde }),
      params,
      orden: 't.ocurrido_at DESC, t.id DESC',
      limite,
      desplazamiento,
    });
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

  contarVisibles(filtro: FiltroDeEventos): Promise<number> {
    const { donde, params } = armarFiltroDeEventos(filtro);
    return this.contar({ uniones: UNION_QR, ...(donde === undefined ? {} : { donde }), params });
  }

  /** Cuántos intentos hubo por resultado y motivo dentro del filtro (indicadores del tablero). */
  resumir(filtro: FiltroDeEventos): Promise<ResumenDeEventosFila[]> {
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
}
