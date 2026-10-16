import type { Pool } from 'mysql2/promise';
import { aIsoONulo } from '../../platform/tiempo/fechas.js';
import {
  RepositorioDeRolesDeUsuario,
  RepositorioDeSesiones,
  type UsuarioFila,
} from './repository.js';

export interface UsuarioListado {
  id: string;
  etiqueta: string | null;
  activo: boolean;
  roles: { id: string; nombre: string }[];
  pin_generado_at: string | null;
  ultimo_ingreso_at: string | null;
  created_at: string;
}

/** Arma los usuarios con sus roles y su último ingreso; nunca con nada del PIN (invariante 6). */
export async function presentarUsuarios(
  pool: Pool,
  filas: readonly UsuarioFila[],
): Promise<UsuarioListado[]> {
  const ids = filas.map((fila) => fila.id);
  const [roles, ingresos] = await Promise.all([
    new RepositorioDeRolesDeUsuario(pool).rolesDeVarios(ids),
    new RepositorioDeSesiones(pool).ultimoIngresoDe(ids),
  ]);
  return filas.map((fila) => ({
    id: fila.id,
    etiqueta: fila.etiqueta,
    activo: fila.activo === 1,
    roles: (roles.get(fila.id) ?? []).map((rol) => ({ id: rol.id, nombre: rol.nombre })),
    pin_generado_at: aIsoONulo(fila.pin_generado_at),
    ultimo_ingreso_at: aIsoONulo(ingresos.get(fila.id) ?? null),
    created_at: fila.created_at.toISOString(),
  }));
}
