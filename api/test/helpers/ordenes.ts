import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { Escenario } from './fixtures.js';

/** Entorno con tiempos pequeños para la petición larga de órdenes: respeta consulta < petición < espera del firmware. */
export const ENTORNO_DE_ORDENES = {
  ORDENES_ESPERA_MS: '600',
  ORDENES_SONDEO_MS: '100',
  PETICION_MS_ORDENES: '2000',
  DB_ESPERA_MS_DISPOSITIVOS: '100',
  DB_CONSULTA_MS_DISPOSITIVOS: '300',
} as const;

export interface OrdenDePrueba {
  readonly id: string;
  readonly lecturaId: string;
}

/**
 * Una orden de apertura escrita directo en la base (sin la API ni los repositorios), con su lectura `manual`. Por
 * omisión: del usuario del escenario, `pendiente`, creada ahora y con 15 s de plazo. `creadaAt` y `venceAt` se pueden
 * fijar para armar órdenes viejas (la tabla exige `vence_at <= created_at + 30 s`).
 */
export async function crearOrdenDePrueba(
  pool: Pool,
  escenario: Escenario,
  puertaId: string,
  opciones: {
    estado?: 'pendiente' | 'entregada' | 'ejecutada' | 'fallida' | 'vencida';
    dispositivoId?: string;
    usuarioId?: string;
    creadaAt?: Date;
    venceAt?: Date;
    clave?: string;
  } = {},
): Promise<OrdenDePrueba> {
  const usuarioId = opciones.usuarioId ?? escenario.usuario.id;
  const creadaAt = opciones.creadaAt ?? new Date();
  const venceAt = opciones.venceAt ?? new Date(creadaAt.getTime() + 15_000);
  const [lectura] = await pool.query<ResultSetHeader>(
    "INSERT INTO lecturas (tenant_id, puerta_id, usuario_id, metodo, resultado, motivo_code, ocurrido_at) VALUES (?, ?, ?, 'manual', 'permitido', 'manual.ordenada', ?)",
    [escenario.cuenta.id, puertaId, usuarioId, creadaAt],
  );
  const estado = opciones.estado ?? 'pendiente';
  const entregada = estado !== 'pendiente' && opciones.dispositivoId !== undefined;
  const [orden] = await pool.query<ResultSetHeader>(
    'INSERT INTO ordenes_apertura (tenant_id, puerta_id, dispositivo_id, usuario_id, lectura_id, estado, vence_at, entregada_at, clave_idempotencia, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      escenario.cuenta.id,
      puertaId,
      opciones.dispositivoId ?? null,
      usuarioId,
      lectura.insertId,
      estado,
      venceAt,
      entregada ? creadaAt : null,
      opciones.clave ?? null,
      creadaAt,
    ],
  );
  return { id: String(orden.insertId), lecturaId: String(lectura.insertId) };
}

export async function ordenDe(pool: Pool, id: string): Promise<RowDataPacket | undefined> {
  const [filas] = await pool.query<RowDataPacket[]>('SELECT * FROM ordenes_apertura WHERE id = ?', [
    id,
  ]);
  return filas[0];
}

export async function confirmacionesDe(pool: Pool, lecturaId: string): Promise<RowDataPacket[]> {
  const [filas] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM confirmaciones_apertura WHERE evento_acceso_id = ? ORDER BY id',
    [lecturaId],
  );
  return filas;
}

export const espera = (ms: number): Promise<void> =>
  new Promise((resolver) => setTimeout(resolver, ms));
