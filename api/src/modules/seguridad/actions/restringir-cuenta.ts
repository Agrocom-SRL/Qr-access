import type { Pool } from 'mysql2/promise';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { cambiarEstadoDeCuenta } from '../cambio-de-estado.js';

/**
 * Restringe una cuenta (AGROCOM, ADR 0031 §0 y punto 4): deja de generar QR nuevos
 * (`qr.generacion_restringida`) pero todo lo ya generado sigue abriendo hasta vencer y nadie pierde la
 * sesión. Sirve para el abuso comprobado mientras se negocia. El motivo es obligatorio.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
  cuentaId: string,
  motivo: string,
  ahora: Date = new Date(),
): Promise<void> {
  await cambiarEstadoDeCuenta(pool, principal, cuentaId, { estado: 'restringido', motivo }, ahora);
}
