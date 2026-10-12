import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { RepositorioDePlanes, RepositorioDeUsoDePlanes } from '../repository.js';

export interface DatosDePlan {
  readonly nombre: string;
  readonly cupoUsuarios: number;
  readonly precioAnual: number;
}

/** Crea un plan que se ofrece desde ya para asignar a cuentas. El nombre es único entre los vigentes. */
export async function crear(pool: Pool, datos: DatosDePlan): Promise<{ id: string }> {
  const planes = new RepositorioDePlanes(pool);
  if ((await planes.buscarPorNombre(datos.nombre)) !== null) {
    throw new ErrorDeDominio('plan.nombre_existente', 409);
  }
  const id = await enTransaccion(pool, (tx) => planes.crear(tx, datos));
  return { id };
}

export interface CambiosDePlan {
  readonly nombre?: string | undefined;
  readonly cupoUsuarios?: number | undefined;
  readonly precioAnual?: number | undefined;
}

/**
 * Edita un plan. El nombre y el precio se pueden cambiar siempre (el precio solo vale para
 * renovaciones y mejoras futuras); el cupo, solo mientras ninguna cuenta use el plan: cambiarlo
 * movería los límites de cuentas que ya pagaron por otra cosa (ADR 0022).
 */
export async function editar(pool: Pool, id: string, cambios: CambiosDePlan): Promise<void> {
  const planes = new RepositorioDePlanes(pool);
  const actual = await planes.buscarActivoPorId(id);
  if (actual === null) throw new ErrorDeDominio('plan.no_encontrado', 404);

  const nuevos: Record<string, unknown> = {};
  if (cambios.nombre !== undefined && cambios.nombre !== actual.nombre) {
    const repetido = await planes.buscarPorNombre(cambios.nombre);
    if (repetido !== null && repetido.id !== id)
      throw new ErrorDeDominio('plan.nombre_existente', 409);
    nuevos.nombre = cambios.nombre;
  }
  if (cambios.cupoUsuarios !== undefined && cambios.cupoUsuarios !== actual.max_usuarios) {
    if ((await new RepositorioDeUsoDePlanes(pool).contarDelPlan(id)) > 0) {
      throw new ErrorDeDominio('plan.en_uso', 422);
    }
    nuevos.max_usuarios = cambios.cupoUsuarios;
  }
  if (cambios.precioAnual !== undefined && cambios.precioAnual !== Number(actual.precio_anual)) {
    nuevos.precio_anual = cambios.precioAnual;
  }
  if (Object.keys(nuevos).length === 0) return;
  await enTransaccion(pool, (tx) => planes.editar(tx, id, nuevos));
}

/**
 * "Eliminar" un plan lo saca de la lista para asignar a cuentas nuevas, pero sigue valiendo para
 * las cuentas que ya lo tienen: si alguna lo usó, solo se retira (`activo = 0`); si nadie lo usó,
 * se borra de forma lógica (invariante 8).
 */
export async function retirar(
  pool: Pool,
  id: string,
): Promise<{ resultado: 'retirado' | 'eliminado' }> {
  const planes = new RepositorioDePlanes(pool);
  if ((await planes.buscarActivoPorId(id)) === null)
    throw new ErrorDeDominio('plan.no_encontrado', 404);
  const enUso = (await new RepositorioDeUsoDePlanes(pool).contarDelPlan(id)) > 0;
  await enTransaccion(pool, (tx) => (enUso ? planes.retirar(tx, id) : planes.eliminar(tx, id)));
  return { resultado: enUso ? 'retirado' : 'eliminado' };
}
