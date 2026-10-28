import type { Pool } from 'mysql2/promise';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { cambiarEstadoDeCuenta } from '../cambio-de-estado.js';

/**
 * Levanta la restricción o la suspensión de una cuenta (AGROCOM): sus usuarios vuelven a ingresar y a
 * generar QR. Los QR que anuló una suspensión no reviven: se generan de nuevo.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
  cuentaId: string,
  ahora: Date = new Date(),
): Promise<void> {
  await cambiarEstadoDeCuenta(pool, principal, cuentaId, { estado: 'activo' }, ahora);
}
