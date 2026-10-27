import type { Pool } from 'mysql2/promise';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { cambiarEstadoDeUsuario } from '../cambio-de-estado.js';

/**
 * Suspende a un usuario de la rama del actor (ADR 0033 §1, ADR 0031 §1, D-25): en la misma transacción
 * se cierran las sesiones de él y de toda su rama y se anulan sus QR vigentes; mientras dure, ninguno de
 * ellos inicia sesión ni abre puertas. Reactivarlo devuelve la rama pero NO revive los QR anulados. El
 * motivo es obligatorio.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  usuarioId: string,
  motivo: string,
  ahora: Date = new Date(),
): Promise<void> {
  await cambiarEstadoDeUsuario(pool, principal, usuarioId, { estado: 'suspendido', motivo }, ahora);
}
