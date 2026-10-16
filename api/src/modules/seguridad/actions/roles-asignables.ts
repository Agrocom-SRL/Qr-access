import type { Pool } from 'mysql2/promise';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { permisoQueExcede } from '../domain/asignacion-de-roles.js';
import { RepositorioDeRoles } from '../repository.js';

/**
 * Comprueba que todos los roles existen en la cuenta y que ninguno tiene un permiso que el actor
 * no tenga con su rol activo (D-19). Un rol ajeno o inactivo no existe: 404.
 */
export async function exigirRolesAsignables(
  pool: Pool,
  principal: PrincipalUsuario,
  rolIds: readonly string[],
): Promise<void> {
  const unicos = [...new Set(rolIds)];
  const repositorio = new RepositorioDeRoles(pool);
  const roles = await repositorio.buscarActivosPorIds(unicos);
  if (roles.length !== unicos.length) throw new ErrorDeDominio('rol.no_encontrado', 404);

  const permisosPorRol = new Map<string, readonly string[]>();
  for (const rol of roles) permisosPorRol.set(rol.id, await repositorio.permisosDeRol(rol.id));
  const exceso = permisoQueExcede(permisosPorRol, principal.permisos);
  if (exceso !== null) {
    throw new ErrorDeDominio('rol.permisos_excedidos', 422, {
      rol_id: exceso.rolId,
      permiso: exceso.permiso,
    });
  }
}
