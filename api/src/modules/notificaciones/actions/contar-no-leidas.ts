import type { OperacionesDeBandeja } from '../repository.js';

/** Cuántas notificaciones sin leer ni descartar tiene el destinatario: la insignia de la app y del panel. */
export async function ejecutar(
  bandeja: OperacionesDeBandeja,
  destinatarioId: string,
): Promise<{ no_leidas: number }> {
  return { no_leidas: await bandeja.contarNoLeidas(destinatarioId) };
}
