import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import {
  RepositorioDeRolesDeUsuario,
  RepositorioDeSesiones,
  RepositorioDeUsuarios,
} from '../repository.js';
import type { ServiciosDeSeguridad } from '../servicios.js';

/**
 * Elige el rol activo entre los que el usuario tiene (HU-05). Devuelve un JWT nuevo con ese
 * rol, sin pedir el PIN otra vez. Un rol que no es suyo (o de otra cuenta) no existe: 404.
 */
export async function ejecutar(
  servicios: ServiciosDeSeguridad,
  principal: PrincipalUsuario,
  rolId: string,
): Promise<{ acceso: string }> {
  const roles = await new RepositorioDeRolesDeUsuario(servicios.pool).rolesDe(principal.usuarioId);
  if (!roles.some((rol) => rol.id === rolId)) throw new ErrorDeDominio('rol.no_encontrado', 404);

  await enTransaccion(servicios.pool, async (tx) => {
    await new RepositorioDeSesiones(servicios.pool).cambiarRolActivo(tx, principal.sesionId, rolId);
    await new RepositorioDeUsuarios(servicios.pool).recordarRolPreferido(
      tx,
      principal.usuarioId,
      rolId,
    );
  });

  const acceso = await servicios.jwt.firmar({
    usuarioId: principal.usuarioId,
    cuentaId: principal.cuentaId,
    sesionId: principal.sesionId,
    rolActivoId: rolId,
  });
  return { acceso };
}
