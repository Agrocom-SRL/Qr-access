import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import type { OperacionesDeBandeja } from '../repository.js';

/** Hasta cuántas se marcan por llamada: la bandeja es chica, pero el tope evita una transacción enorme. */
const TOPE = 500;

/** Marca como leídas todas las no leídas del destinatario; devuelve cuántas marcó. */
export async function ejecutar(
  pool: Pool,
  bandeja: OperacionesDeBandeja,
  destinatarioId: string,
  ahora: Date = new Date(),
): Promise<{ marcadas: number }> {
  const ids = await bandeja.idsNoLeidas(destinatarioId, TOPE);
  await enTransaccion(pool, async (tx) => {
    for (const id of ids) await bandeja.marcarLeida(tx, id, ahora);
  });
  return { marcadas: ids.length };
}
