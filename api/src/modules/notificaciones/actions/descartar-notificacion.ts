import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { OperacionesDeBandeja } from '../repository.js';

/**
 * Descarta una notificación DEL destinatario: sale de su bandeja (y deja de contar como no leída). La fila no se
 * borra. Si el aviso agrupado vuelve a crecer con una placa nueva, reaparece (ver `actualizarIncidente`).
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
  if (fila.descartada_at !== null) return;
  await enTransaccion(pool, async (tx) => {
    await bandeja.descartar(tx, id, ahora);
  });
}
