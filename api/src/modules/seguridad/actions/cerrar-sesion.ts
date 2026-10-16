import { enTransaccion } from '../../../platform/db/transaccion.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { RepositorioDeSesiones } from '../repository.js';
import type { ServiciosDeSeguridad } from '../servicios.js';

/** Revoca la sesión: su refresh deja de servir y su JWT de acceso, que se revalida en cada petición, también. */
export async function ejecutar(
  servicios: Pick<ServiciosDeSeguridad, 'pool'>,
  principal: PrincipalUsuario,
  ahora: Date = new Date(),
): Promise<void> {
  await enTransaccion(servicios.pool, (tx) =>
    new RepositorioDeSesiones(servicios.pool).revocar(tx, principal.sesionId, ahora),
  );
}
