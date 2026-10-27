import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { OperacionesDeBandeja } from '../repository.js';

/**
 * Marca como leída una notificación DEL destinatario; la de otra persona o cuenta es un 404, no un 403, para no
 * confirmar que existe (invariante 1). Repetirlo no cambia nada.
 */
export async function ejecutar(
  pool: Pool,
  bandeja: OperacionesDeBandeja,
  destinatarioId: string,
  id: string,
  ahora: Date = new Date(),
): Promise<void> {
  const fila = await bandeja.buscarDe(destinatarioId, id);
  if (fila === null) throw new ErrorDeDominio('notificacion.no_encontrada', 404);
  if (fila.leida_at !== null) return;
  await enTransaccion(pool, async (tx) => {
    await bandeja.marcarLeida(tx, id, ahora);
  });
}
