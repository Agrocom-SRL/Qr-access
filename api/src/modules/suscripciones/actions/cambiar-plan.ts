import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { diferenciaDePrecio, estadoDeSuscripcion, esMejoraDePlan } from '../domain/estado.js';
import { RepositorioDePlanes, RepositorioDeSuscripciones } from '../repository.js';
import { suscripcionActualODeLaCuenta } from './contexto-de-suscripcion.js';

export interface PlanCambiado {
  plan: { id: string; nombre: string; cupo_usuarios: number | null };
  /** Lo que hay que cobrar por el cambio: se registra como un pago `mejora_de_plan`. */
  diferencia_precio: number;
}

/**
 * Sube la cuenta del contexto a un plan MAYOR en mitad de su suscripción (ADR 0022): nunca se
 * baja de plan (no se devuelve dinero) y se cobra la diferencia de precio. Una suscripción
 * suspendida o vencida no cambia de plan: primero se reactiva o se renueva.
 */
export async function ejecutar(
  pool: Pool,
  planNuevoId: string,
  ahora: Date = new Date(),
): Promise<PlanCambiado> {
  const suscripcion = await suscripcionActualODeLaCuenta(pool);
  const estado = estadoDeSuscripcion(suscripcion, ahora);
  if (estado === 'pendiente_pago') throw new ErrorDeDominio('suscripcion.pendiente_de_pago', 422);
  if (estado === 'suspendida') throw new ErrorDeDominio('suscripcion.suspendida', 422);
  if (estado === 'vencida') throw new ErrorDeDominio('suscripcion.vencida', 422);

  const nuevo = await new RepositorioDePlanes(pool).buscarActivoPorId(planNuevoId);
  if (nuevo === null) throw new ErrorDeDominio('plan.no_encontrado', 404);
  if (nuevo.id === suscripcion.plan_id) throw new ErrorDeDominio('plan.sin_cambio', 422);
  if (!esMejoraDePlan(suscripcion.max_usuarios, nuevo.max_usuarios)) {
    throw new ErrorDeDominio('plan.solo_mejora', 422);
  }

  await enTransaccion(pool, (tx) =>
    new RepositorioDeSuscripciones(pool).cambiarPlan(tx, suscripcion.id, nuevo.id),
  );
  return {
    plan: { id: nuevo.id, nombre: nuevo.nombre, cupo_usuarios: nuevo.max_usuarios },
    diferencia_precio: diferenciaDePrecio(
      Number(suscripcion.precio_anual),
      Number(nuevo.precio_anual),
    ),
  };
}
