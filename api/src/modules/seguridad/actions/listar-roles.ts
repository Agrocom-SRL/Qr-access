import type { Pool } from 'mysql2/promise';
import { RepositorioDeRoles } from '../repository.js';

export interface RolListado {
  id: string;
  nombre: string;
}

/** Los roles activos de la cuenta, para asignarlos a un usuario (HU-06). */
export async function ejecutar(pool: Pool): Promise<{ datos: RolListado[] }> {
  const roles = await new RepositorioDeRoles(pool).listarActivos();
  return { datos: roles.map((rol) => ({ id: rol.id, nombre: rol.nombre })) };
}
