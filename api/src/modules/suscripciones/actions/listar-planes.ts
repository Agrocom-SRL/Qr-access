import type { Pool } from 'mysql2/promise';
import { crearServicioDeConteoDeUsuarios } from '../../seguridad/contracts.js';
import { RepositorioDePlanes, RepositorioDeUsoDePlanes } from '../repository.js';

export interface PlanListado {
  id: string;
  nombre: string;
  cupo_usuarios: number | null;
  precio_anual: number;
  cuentas: number;
  usuarios_en_uso: number;
}

/** Los planes con su precio y cuánto se usan: cuentas por plan y usuarios activos de esas cuentas (A09). */
export async function ejecutar(pool: Pool): Promise<PlanListado[]> {
  const [planes, cuentasPorPlan] = await Promise.all([
    new RepositorioDePlanes(pool).listarActivos(),
    new RepositorioDeUsoDePlanes(pool).cuentasPorPlan(),
  ]);
  const todas = [...new Set([...cuentasPorPlan.values()].flat())];
  const usuarios = await crearServicioDeConteoDeUsuarios(pool).activosPorCuenta(todas);
  return planes.map((plan) => {
    const cuentas = cuentasPorPlan.get(plan.id) ?? [];
    return {
      id: plan.id,
      nombre: plan.nombre,
      cupo_usuarios: plan.max_usuarios,
      precio_anual: Number(plan.precio_anual),
      cuentas: cuentas.length,
      usuarios_en_uso: cuentas.reduce((suma, id) => suma + (usuarios.get(id) ?? 0), 0),
    };
  });
}
