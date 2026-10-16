import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { RepositorioDePlanes } from '../repository.js';

export interface CambioDePrecio {
  readonly planId: string;
  readonly precioAnual: number;
}

/**
 * Guarda los precios de varios planes de una vez (A09, "Guardar precios"): todos o ninguno. Solo
 * afecta renovaciones y mejoras futuras; las suscripciones vigentes conservan lo que pagaron.
 */
export async function ejecutar(pool: Pool, cambios: readonly CambioDePrecio[]): Promise<void> {
  const planes = new RepositorioDePlanes(pool);
  const ids = cambios.map((c) => c.planId);
  if (new Set(ids).size !== ids.length) throw new ErrorDeDominio('validacion.invalida', 400);
  for (const cambio of cambios) {
    if ((await planes.buscarActivoPorId(cambio.planId)) === null) {
      throw new ErrorDeDominio('plan.no_encontrado', 404);
    }
  }
  await enTransaccion(pool, async (tx) => {
    for (const cambio of cambios) await planes.cambiarPrecio(tx, cambio.planId, cambio.precioAnual);
  });
}
