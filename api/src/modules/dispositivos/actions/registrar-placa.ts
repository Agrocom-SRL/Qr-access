import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { hashear } from '../../../platform/seguridad/hash.js';
import { generarCodigoDeVinculacion, normalizarMac } from '../domain/placa.js';
import { RepositorioDePlacas } from '../placas-repository.js';

/**
 * Da de alta una placa con su MAC y le sortea el código de vinculación (ADR 0025 §8). El código
 * en claro se devuelve UNA vez, para cargarlo en la placa; en la base queda su hash argon2id.
 */
export async function ejecutar(
  pool: Pool,
  macCrudo: string,
): Promise<{ id: string; mac: string; codigo: string }> {
  const mac = normalizarMac(macCrudo);
  if (mac === null) throw new ErrorDeDominio('placa.mac_invalida', 422);

  const placas = new RepositorioDePlacas(pool);
  if ((await placas.buscarPorMac(mac)) !== null)
    throw new ErrorDeDominio('placa.mac_existente', 409);

  const codigo = generarCodigoDeVinculacion();
  const codigoHash = await hashear(codigo);
  try {
    const id = await enTransaccion(pool, (tx) => placas.crear(tx, mac, codigoHash));
    return { id, mac, codigo };
  } catch (error) {
    // Otra alta tomó la misma MAC entre la consulta y el INSERT.
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ER_DUP_ENTRY'
    ) {
      throw new ErrorDeDominio('placa.mac_existente', 409);
    }
    throw error;
  }
}
