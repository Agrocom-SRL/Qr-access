import type { Pool } from 'mysql2/promise';
import { purgarClavesDeIdempotenciaVencidas } from '../repository.js';

/**
 * Borra las claves de idempotencia vencidas de todas las cuentas (ADR 0031 §11, «se descarta cuando vence»).
 * Mantenimiento: no toca datos de dominio y devuelve cuántas filas descartó. La corre la ruta cada hora.
 */
export async function ejecutar(pool: Pool, ahora: Date = new Date()): Promise<number> {
  return purgarClavesDeIdempotenciaVencidas(pool, ahora);
}
