import { enTransaccion } from '../../../platform/db/transaccion.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { RepositorioDeSesionesDeSuperAdmins } from '../repository.js';
import type { ServiciosDeSeguridad } from '../servicios.js';

/** Revoca la sesión del super admin: su refresh y su JWT dejan de servir en el acto. */
export async function ejecutar(
  servicios: Pick<ServiciosDeSeguridad, 'pool'>,
  principal: PrincipalPlataforma,
  ahora: Date = new Date(),
): Promise<void> {
  await enTransaccion(servicios.pool, (tx) =>
    new RepositorioDeSesionesDeSuperAdmins(servicios.pool).revocar(tx, principal.sesionId, ahora),
  );
}
