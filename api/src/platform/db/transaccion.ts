import type { Pool, PoolConnection } from 'mysql2/promise';

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
