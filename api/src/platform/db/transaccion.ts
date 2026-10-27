import type { Pool, PoolConnection } from 'mysql2/promise';
import { esErrorDeBloqueo, PresupuestoAgotado } from '../errores/servicio-no-disponible.js';

export type Transaccion = PoolConnection;

/** Opciones de una transacción con presupuesto de tiempo. */
export interface OpcionesDeTransaccion {
  /**
   * Presupuesto de la petición (`presupuestoDePeticion`): se aborta al vencer su plazo propio o
   * al cortarse la conexión del cliente. NO es `request.signal` de Fastify, que en Node 22 llega
   * abortada tras leer el cuerpo. Ya abortada, la transacción no empieza, no se reintenta y NO
   * hace COMMIT.
   */
  readonly señal?: AbortSignal;
  /**
   * Segundos que esta transacción espera un bloqueo antes de rendirse (`innodb_lock_wait_timeout`). Para las
   * tareas periódicas (ADR 0032 §1): ceden pronto ante una validación en vez de hacerla esperar. Se restaura
   * al devolver la conexión al pool, para que no contamine a quien la reciba después.
   */
  readonly esperaDeBloqueoS?: number;
}

/** Cuánto esperan un bloqueo las tareas periódicas: poco, para ceder ante una validación (ADR 0032). */
export const ESPERA_DE_BLOQUEO_DE_TAREA_S = 2;

/**
 * Fija `innodb_lock_wait_timeout` en la sesión de `conexion`. Quien lo llama DEBE terminar con
 * `devolverConexion`, que lo restaura: una conexión del pool con el tope cambiado le llegaría a otro.
 */
export async function fijarEsperaDeBloqueo(
  conexion: PoolConnection,
  segundos: number,
): Promise<void> {
  await conexion.query('SET SESSION innodb_lock_wait_timeout = ?', [segundos]);
}

/**
 * Devuelve la conexión al pool. Con `restaurarEspera` vuelve el tope de bloqueo al de la base; si eso falla
 * (conexión rota), la conexión se destruye en vez de devolverse con un valor ajeno.
 */
export async function devolverConexion(
  conexion: PoolConnection,
  restaurarEspera: boolean,
): Promise<void> {
  if (restaurarEspera) {
    try {
      await conexion.query('SET SESSION innodb_lock_wait_timeout = DEFAULT');
    } catch {
      conexion.destroy();
      return;
    }
  }
  conexion.release();
}

/**
 * Ejecuta `fn` en una transacción sobre una conexión que YA tiene quien llama (p. ej. la que sostiene un
 * bloqueo de tarea): COMMIT si termina, ROLLBACK si lanza. Nunca pide otra conexión al pool.
 */
export async function enTransaccionSobre<T>(
  conexion: PoolConnection,
  fn: (tx: Transaccion) => Promise<T>,
): Promise<T> {
  await conexion.beginTransaction();
  try {
    const resultado = await fn(conexion);
    await conexion.commit();
    return resultado;
  } catch (error) {
    await conexion.rollback();
    throw error;
  }
}

/** Función aparte: el chequeo se repite tras un `await` y TS estrecharía `aborted` a `false`. */
function vencida(señal: AbortSignal | undefined): boolean {
  return señal?.aborted === true;
}

/** Ejecuta `fn` dentro de una transacción: COMMIT si termina, ROLLBACK si lanza. */
export async function enTransaccion<T>(
  pool: Pool,
  fn: (tx: Transaccion) => Promise<T>,
  { señal, esperaDeBloqueoS }: OpcionesDeTransaccion = {},
): Promise<T> {
  const conexion = await pool.getConnection();
  try {
    if (esperaDeBloqueoS !== undefined) await fijarEsperaDeBloqueo(conexion, esperaDeBloqueoS);
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
    await devolverConexion(conexion, esperaDeBloqueoS !== undefined);
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
