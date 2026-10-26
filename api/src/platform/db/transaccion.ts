import type { Pool, PoolConnection } from 'mysql2/promise';
import { esErrorDeBloqueo } from '../errores/servicio-no-disponible.js';

export type Transaccion = PoolConnection;

/** Ejecuta `fn` dentro de una transacción: COMMIT si termina, ROLLBACK si lanza. */
export async function enTransaccion<T>(
  pool: Pool,
  fn: (tx: Transaccion) => Promise<T>,
): Promise<T> {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await fn(conexion);
    await conexion.commit();
    return resultado;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

/**
 * Como `enTransaccion`, pero ante un deadlock o un timeout de bloqueo (la base ya deshizo la
 * transacción) la repite UNA vez; si vuelve a fallar, el error sale y la API responde 503
 * (ADR 0032 §2). Solo para transacciones idempotentes: `fn` no puede tener efectos fuera de
 * la base ni depender de que se ejecute una sola vez (p. ej. la validación de un QR, cuyo
 * consumo y evento se deshacen juntos).
 */
export async function enTransaccionIdempotente<T>(
  pool: Pool,
  fn: (tx: Transaccion) => Promise<T>,
): Promise<T> {
  try {
    return await enTransaccion(pool, fn);
  } catch (error) {
    if (!esErrorDeBloqueo(error)) throw error;
    return enTransaccion(pool, fn);
  }
}
