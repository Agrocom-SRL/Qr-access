import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import {
  devolverConexion,
  ESPERA_DE_BLOQUEO_DE_TAREA_S,
  fijarEsperaDeBloqueo,
} from './transaccion.js';

export type ResultadoConBloqueo<T> =
  { readonly obtenido: true; readonly valor: T } | { readonly obtenido: false };

/**
 * Corre `fn` con un bloqueo de aplicación (`GET_LOCK`) de nombre `nombre`, sin esperar: si otra instancia ya lo
 * tiene, devuelve `obtenido: false` y la pasada se salta (la próxima lo reintenta). Sirve para serializar una
 * tarea periódica (por cuenta o global) SIN bloquear filas de negocio: un `GET_LOCK` no es padre de ninguna FK,
 * así que no hace esperar a una validación de QR ni a un latido (ADR 0032 §1).
 *
 * `fn` recibe la conexión que sostiene el bloqueo y DEBE hacer todo su trabajo con ella (`enTransaccionSobre`):
 * quien retiene el bloqueo nunca espera otra conexión del pool. La conexión espera como mucho
 * `ESPERA_DE_BLOQUEO_DE_TAREA_S` por un bloqueo de fila y siempre libera el bloqueo (o se destruye si no pudo).
 * `nombre` mide como mucho 64 caracteres (límite de MariaDB) y va como parámetro, nunca interpolado.
 */
export async function conBloqueoDeTarea<T>(
  pool: Pool,
  nombre: string,
  fn: (conexion: PoolConnection) => Promise<T>,
): Promise<ResultadoConBloqueo<T>> {
  const conexion = await pool.getConnection();
  let liberada = true;
  try {
    await fijarEsperaDeBloqueo(conexion, ESPERA_DE_BLOQUEO_DE_TAREA_S);
    const [filas] = await conexion.query<RowDataPacket[]>('SELECT GET_LOCK(?, 0) AS obtenido', [
      nombre,
    ]);
    if (Number(filas[0]?.obtenido) !== 1) return { obtenido: false };
    try {
      return { obtenido: true, valor: await fn(conexion) };
    } finally {
      try {
        await conexion.query('DO RELEASE_LOCK(?)', [nombre]);
      } catch {
        // No se pudo liberar: se destruye la conexión (cierra la sesión y con ella el bloqueo).
        liberada = false;
      }
    }
  } finally {
    if (liberada) await devolverConexion(conexion, true);
    else conexion.destroy();
  }
}
