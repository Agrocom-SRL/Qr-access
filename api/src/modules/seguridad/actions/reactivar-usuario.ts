import type { Pool } from 'mysql2/promise';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { cambiarEstadoDeUsuario } from '../cambio-de-estado.js';

/**
 * Levanta la restricción o la suspensión de un usuario de la rama del actor: él vuelve a `activo` y su
 * rama con él, salvo quien tenga un estado propio. Exige el permiso del estado que levanta, y solo lo
 * levanta quien lo impuso o un superior suyo: un estado impuesto desde arriba responde
 * `estado.impuesto_por_superior`. Los QR anulados por una suspensión no reviven.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  usuarioId: string,
  ahora: Date = new Date(),
): Promise<void> {
  await cambiarEstadoDeUsuario(pool, principal, usuarioId, { estado: 'activo' }, ahora);
}
