import type { Pool, PoolConnection } from 'mysql2/promise';
import { esErrorDeBloqueo, PresupuestoAgotado } from '../errores/servicio-no-disponible.js';

export type Transaccion = PoolConnection;

/** Opciones de una transacción con presupuesto de tiempo. */
export interface OpcionesDeTransaccion {
  /**
   * Señal de la petición (`request.signal`): se aborta al vencer su tiempo máximo o al cortarse
   * la conexión. Ya abortada, la transacción no empieza, no se reintenta y NO hace COMMIT.
   */
  readonly señal?: AbortSignal;
}

/** Función aparte: el chequeo se repite tras un `await` y TS estrecharía `aborted` a `false`. */
function vencida(señal: AbortSignal | undefined): boolean {
  return señal?.aborted === true;
}

/** Ejecuta `fn` dentro de una transacción: COMMIT si termina, ROLLBACK si lanza. */
export async function enTransaccion<T>(
  pool: Pool,
  fn: (tx: Transaccion) => Promise<T>,
  { señal }: OpcionesDeTransaccion = {},
): Promise<T> {
  const conexion = await pool.getConnection();
  try {
    // Conexión obtenida tarde: nadie espera ya la respuesta, no se empieza nada.
    if (vencida(señal)) throw new PresupuestoAgotado();
    await conexion.beginTransaction();
    const resultado = await fn(conexion);
    // Último punto en que se puede desistir: pasado el presupuesto, la placa ya no espera la
    // respuesta (falla segura, invariante 2). El COMMIT confirmaría un consumo cuya apertura
    // nadie va a ordenar; el ROLLBACK deja el QR sin consumir.
    if (vencida(señal)) throw new PresupuestoAgotado();
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
 * Como `enTransaccion`, pero ante un deadlock o un timeout de bloqueo la repite UNA vez; si
 * vuelve a fallar, el error sale y la API responde 503 (ADR 0032 §2). Cada intento termina en
 * ROLLBACK explícito (el `catch` de `enTransaccion`), así que el segundo parte limpio aunque la
 * base solo haya deshecho la sentencia. Solo para transacciones idempotentes: `fn` no puede
 * tener efectos fuera de la base ni depender de que se ejecute una sola vez (p. ej. la
 * validación de un QR, cuyo consumo y evento se deshacen juntos).
 *
 * Con `señal` vencida no se reintenta: repetir trabajo para una respuesta que nadie espera solo
 * ocupa una conexión del pool reservado a las puertas.
 */
export async function enTransaccionIdempotente<T>(
  pool: Pool,
  fn: (tx: Transaccion) => Promise<T>,
  opciones: OpcionesDeTransaccion = {},
): Promise<T> {
  try {
    return await enTransaccion(pool, fn, opciones);
  } catch (error) {
    if (!esErrorDeBloqueo(error) || vencida(opciones.señal)) throw error;
    return enTransaccion(pool, fn, opciones);
  }
}
