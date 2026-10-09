import type { Pool, RowDataPacket } from 'mysql2/promise';
import { RepositorioDeCuenta } from '../../platform/db/repositorio-de-cuenta.js';
import type { Transaccion } from '../../platform/db/transaccion.js';
import type { EstadoDeQr } from './domain/estado-qr.js';

export interface QrFila extends RowDataPacket {
  id: string;
  emitido_por: string;
  etiqueta: string | null;
  vence_at: Date;
  usado_at: Date | null;
  anulado_at: Date | null;
  created_at: Date;
}

const COLUMNAS_DE_QR =
  't.id, t.emitido_por, t.etiqueta, t.vence_at, t.usado_at, t.anulado_at, t.created_at';

export interface NuevoQr {
  readonly emitidoPor: string;
  readonly tokenHash: string;
  readonly etiqueta: string | null;
  readonly venceAt: Date;
}

export interface FiltroDeQr {
  readonly estado: EstadoDeQr | null;
  /** Solo los emitidos por este usuario; `null` = todos los de la cuenta. */
  readonly emitidoPor: string | null;
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
  const condiciones: string[] = [];
  const params: unknown[] = [];
  if (filtro.estado !== null) {
    condiciones.push(CONDICION_DE_ESTADO[filtro.estado]);
    if (filtro.estado === 'vencido' || filtro.estado === 'vigente') params.push(filtro.ahora);
  }
  if (filtro.emitidoPor !== null) {
    condiciones.push('t.emitido_por = ?');
    params.push(filtro.emitidoPor);
  }
  return condiciones.length === 0 ? { params } : { donde: condiciones.join(' AND '), params };
}

/** Dueño de `qr_accesos`. */
export class RepositorioDeQr extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'qr_accesos',
      columnas: [
        'emitido_por',
        'token_hash',
        'etiqueta',
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
      emitido_por: qr.emitidoPor,
      token_hash: qr.tokenHash,
      etiqueta: qr.etiqueta,
      vence_at: qr.venceAt,
    });
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

  listar(emitidoPor: string | null, limite: number, desplazamiento: number): Promise<EventoFila[]> {
    return this.seleccionar<EventoFila>({
      columnas: 't.id, t.ocurrido_at, t.resultado, t.motivo_code, t.puerta_id, t.qr_acceso_id',
      uniones: UNION_QR,
      ...(emitidoPor === null ? {} : { donde: 'q.emitido_por = ?', params: [emitidoPor] }),
      orden: 't.ocurrido_at DESC, t.id DESC',
      limite,
      desplazamiento,
    });
  }

  contarVisibles(emitidoPor: string | null): Promise<number> {
    return this.contar({
      uniones: UNION_QR,
      ...(emitidoPor === null ? {} : { donde: 'q.emitido_por = ?', params: [emitidoPor] }),
    });
  }
}
