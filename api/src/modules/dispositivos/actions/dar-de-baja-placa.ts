import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { RepositorioDePlacas } from '../placas-repository.js';
import { RepositorioDeDispositivosDePlataforma } from '../repository.js';

/** Baja de una placa perdida o destruida (soft delete). Una placa vinculada se libera antes. */
export async function ejecutar(pool: Pool, placaId: string): Promise<void> {
  if (
    (await new RepositorioDeDispositivosDePlataforma(pool).buscarEnServicioDePlaca(placaId)) !==
    null
  ) {
    throw new ErrorDeDominio('placa.ya_vinculada', 409);
  }
  const placas = new RepositorioDePlacas(pool);
  const baja = await enTransaccion(pool, (tx) => placas.darDeBaja(tx, placaId));
  if (!baja) throw new ErrorDeDominio('placa.no_encontrada', 404);
}
