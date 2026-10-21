import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { RepositorioDeSuscripciones } from '../repository.js';
import { suscripcionActualODeLaCuenta } from './contexto-de-suscripcion.js';

/**
 * Suspende (`suspendida`) o reactiva (`vigente`) la suscripción de la cuenta del contexto. Suspendida,
 * la cuenta no genera QR y sus puertas rechazan con `suscripcion.vencida` (RF-06). Es idempotente.
 */
export async function ejecutar(pool: Pool, nuevo: 'vigente' | 'suspendida'): Promise<void> {
  const suscripcion = await suscripcionActualODeLaCuenta(pool);
  if (suscripcion.estado === 'pendiente')
    throw new ErrorDeDominio('suscripcion.pendiente_de_pago', 422);
  if (suscripcion.estado === nuevo) return;
  if (suscripcion.estado === 'vencida') throw new ErrorDeDominio('suscripcion.vencida', 422);
  await enTransaccion(pool, (tx) =>
    new RepositorioDeSuscripciones(pool).cambiarEstado(tx, suscripcion.id, nuevo),
  );
}
