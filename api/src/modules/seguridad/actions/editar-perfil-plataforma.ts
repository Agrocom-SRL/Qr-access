import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { RepositorioDeSuperAdmins } from '../repository.js';

/** El super admin cambia su propio nombre (A12). No pide permiso aparte: es su perfil. */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
  nombre: string,
): Promise<void> {
  const admins = new RepositorioDeSuperAdmins(pool);
  if ((await admins.buscarActivoPorId(principal.usuarioId)) === null) {
    throw new ErrorDeDominio('autenticacion.requerida', 401);
  }
  await enTransaccion(pool, (tx) => admins.renombrar(tx, principal.usuarioId, nombre));
}
