import type { Pool } from 'mysql2/promise';
import {
  armarListado,
  limiteDe,
  type Listado,
  type Paginacion,
} from '../../../platform/http/paginacion.js';
import { presentarUsuarios, type UsuarioListado } from '../presentacion.js';
import { RepositorioDeUsuarios } from '../repository.js';

/** Los usuarios (PIN) de la cuenta del contexto con sus roles (HU-06). */
export async function ejecutar(
  pool: Pool,
  paginacion: Paginacion,
): Promise<Listado<UsuarioListado>> {
  const repositorio = new RepositorioDeUsuarios(pool);
  const { limite, desplazamiento } = limiteDe(paginacion);
  const [filas, total] = await Promise.all([
    repositorio.listar(limite, desplazamiento),
    repositorio.contarTodos(),
  ]);
  return armarListado(await presentarUsuarios(pool, filas), paginacion, total);
}
