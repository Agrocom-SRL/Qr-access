import type { Pool } from 'mysql2/promise';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { nivelDeRol, type NivelDeUsuario } from '../domain/jerarquia.js';
import { RepositorioDeRolesDeUsuario } from '../repository.js';

/**
 * El nivel del actor en el árbol (ADR 0028), según su único rol vigente. `null` si no tiene un
 * rol con nivel: en ese caso no crea a nadie (falla cerrado).
 */
export async function nivelDelActor(
  pool: Pool,
  principal: PrincipalUsuario,
): Promise<NivelDeUsuario | null> {
  const roles = await new RepositorioDeRolesDeUsuario(pool).rolesDe(principal.usuarioId);
  const [unico] = roles;
  return roles.length === 1 && unico !== undefined ? nivelDeRol(unico.nombre) : null;
}
