import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { RepositorioDePlacas } from '../placas-repository.js';

/** Retira la solicitud de vínculo que espera el botón de la placa (ADR 0026 §4). */
export async function ejecutar(
  pool: Pool,
  placaId: string,
  ahora: Date = new Date(),
): Promise<void> {
  const placas = new RepositorioDePlacas(pool);
  await enTransaccion(pool, async (tx) => {
    const placa = await placas.buscarPorId(placaId, tx);
    if (placa === null) throw new ErrorDeDominio('placa.no_encontrada', 404);
    if (placa.por_confirmar_hasta === null || placa.por_confirmar_hasta <= ahora) {
      throw new ErrorDeDominio('placa.sin_solicitud', 409);
    }
    await placas.limpiarSolicitud(tx, placa.id);
  });
}
