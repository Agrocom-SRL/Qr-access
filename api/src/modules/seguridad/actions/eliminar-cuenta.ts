import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { RepositorioDeCuentasDePlataforma } from '../repository.js';

/**
 * Da de baja una cuenta (soft delete, invariante 8): nadie de ella vuelve a ingresar, sus
 * dispositivos dejan de autenticarse y su código queda libre para otra cuenta. Los datos se
 * conservan para la bitácora y la contabilidad. La confirmación escribiendo el código la pide el
 * panel; acá solo se exige que el código enviado coincida, para que una llamada por error no
 * borre una cuenta ajena.
 */
export async function ejecutar(
  pool: Pool,
  cuentaId: string,
  codigoDeConfirmacion: string,
): Promise<void> {
  const cuentas = new RepositorioDeCuentasDePlataforma(pool);
  const cuenta = await cuentas.buscarPorId(cuentaId);
  if (cuenta === null) throw new ErrorDeDominio('cuenta.no_encontrada', 404);
  if (cuenta.codigo !== codigoDeConfirmacion.trim().toUpperCase()) {
    throw new ErrorDeDominio('cuenta.confirmacion_invalida', 422);
  }
  await enTransaccion(pool, (tx) => cuentas.eliminar(tx, cuenta.id));
}
