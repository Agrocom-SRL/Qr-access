import type { Pool } from 'mysql2/promise';
import {
  armarListado,
  limiteDe,
  type Listado,
  type Paginacion,
} from '../../../platform/http/paginacion.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { aIsoONulo } from '../../../platform/tiempo/fechas.js';
import { RepositorioDeSesionesDeSuperAdmins, RepositorioDeSuperAdmins } from '../repository.js';

export interface MiembroDelEquipo {
  id: string;
  nombre: string | null;
  usuario: string;
  activo: boolean;
  /** `true` en la fila de quien consulta (la interfaz dice "Tú"). */
  es_actual: boolean;
  ultimo_ingreso_at: string | null;
  created_at: string;
}

export interface ListadoDelEquipo extends Listado<MiembroDelEquipo> {
  activos: number;
}

/** El equipo AGROCOM (A11): los activos primero, con su último ingreso y cuántos hay activos. */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
  paginacion: Paginacion,
): Promise<ListadoDelEquipo> {
  const admins = new RepositorioDeSuperAdmins(pool);
  const { limite, desplazamiento } = limiteDe(paginacion);
  const [filas, total, activos] = await Promise.all([
    admins.listar(limite, desplazamiento),
    admins.contarTodos(),
    admins.contarActivos(),
  ]);
  const ingresos = await new RepositorioDeSesionesDeSuperAdmins(pool).ultimoIngresoDe(
    filas.map((fila) => fila.id),
  );
  const datos = filas.map((fila) => ({
    id: fila.id,
    nombre: fila.etiqueta,
    usuario: fila.username,
    activo: fila.activo === 1,
    es_actual: fila.id === principal.usuarioId,
    ultimo_ingreso_at: aIsoONulo(ingresos.get(fila.id) ?? null),
    created_at: fila.created_at.toISOString(),
  }));
  return { ...armarListado(datos, paginacion, total), activos };
}
