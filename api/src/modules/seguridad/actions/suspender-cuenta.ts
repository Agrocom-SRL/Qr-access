import type { Pool } from 'mysql2/promise';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { cambiarEstadoDeCuenta } from '../cambio-de-estado.js';

/**
 * Suspende una cuenta (AGROCOM, ADR 0031 §1): en la misma transacción se cierran las sesiones de todos
 * sus usuarios y se anulan todos sus QR vigentes; ninguno inicia sesión y ninguna puerta de la cuenta
 * abre. Reactivarla no revive los QR anulados. El motivo es obligatorio.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
  cuentaId: string,
  motivo: string,
  ahora: Date = new Date(),
): Promise<void> {
  await cambiarEstadoDeCuenta(pool, principal, cuentaId, { estado: 'suspendido', motivo }, ahora);
}
