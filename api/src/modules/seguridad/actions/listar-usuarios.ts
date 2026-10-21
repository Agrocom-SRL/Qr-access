import type { Pool } from 'mysql2/promise';
import {
  armarListado,
  limiteDe,
  type Listado,
  type Paginacion,
} from '../../../platform/http/paginacion.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { presentarUsuarios, type UsuarioListado } from '../presentacion.js';
import { RepositorioDeUsuarios } from '../repository.js';

/**
 * Los usuarios de la rama del actor, con su rol (HU-06, ADR 0028 §4): cada uno ve solo a quienes
 * cuelgan de él, nunca a un igual ni a un superior. El propio actor no aparece.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  paginacion: Paginacion,
): Promise<Listado<UsuarioListado>> {
  const repositorio = new RepositorioDeUsuarios(pool);
  const { limite, desplazamiento } = limiteDe(paginacion);
  const [filas, total] = await Promise.all([
    repositorio.listarDeRama(principal.usuarioId, limite, desplazamiento),
    repositorio.contarDeRama(principal.usuarioId),
  ]);
  return armarListado(await presentarUsuarios(pool, filas), paginacion, total);
}
