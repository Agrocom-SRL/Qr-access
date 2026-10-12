import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { sumarMeses } from '../../../platform/tiempo/fechas.js';
import {
  RepositorioDePagos,
  RepositorioDeSuscripciones,
  type MedioDePago,
  type TipoDePago,
} from '../repository.js';
import { suscripcionActualODeLaCuenta } from './contexto-de-suscripcion.js';

export interface DatosDePago {
  readonly tipo: TipoDePago;
  readonly monto: number;
  readonly fechaPago: string;
  readonly medio: MedioDePago;
  readonly referencia: string;
}

export interface PagoRegistrado {
  id: string;
  tipo: TipoDePago;
  periodo_desde: string;
  periodo_hasta: string;
  /** Vencimiento de la suscripción después del pago. */
  vence_el: string;
}

/**
 * Registra un pago manual de la cuenta del contexto (D-15, ADR 0022), todo o nada:
 * - `renovacion`: extiende la suscripción 12 meses desde su vencimiento actual y el pago cubre ese año.
 * - `mejora_de_plan`: cobra la diferencia de un cambio de plan; no cambia la vigencia y cubre lo que resta del periodo.
 * Una suscripción suspendida no se renueva: primero se reactiva.
 */
export async function ejecutar(pool: Pool, datos: DatosDePago): Promise<PagoRegistrado> {
  const suscripcion = await suscripcionActualODeLaCuenta(pool);
  if (suscripcion.estado === 'suspendida') {
    throw new ErrorDeDominio('suscripcion.suspendida', 422);
  }
  const renueva = datos.tipo === 'renovacion';
  const nuevoHasta = renueva ? sumarMeses(suscripcion.hasta, 12) : suscripcion.hasta;
  const periodoDesde = renueva ? suscripcion.hasta : suscripcion.desde;

  const pagoId = await enTransaccion(pool, async (tx) => {
    if (renueva) await new RepositorioDeSuscripciones(pool).renovar(tx, suscripcion.id, nuevoHasta);
    return new RepositorioDePagos(pool).registrar(tx, {
      suscripcionId: suscripcion.id,
      planId: suscripcion.plan_id,
      tipo: datos.tipo,
      monto: datos.monto,
      fechaPago: datos.fechaPago,
      medio: datos.medio,
      referencia: datos.referencia,
      periodoDesde,
      periodoHasta: nuevoHasta,
    });
  });
  return {
    id: pagoId,
    tipo: datos.tipo,
    periodo_desde: periodoDesde.toISOString(),
    periodo_hasta: nuevoHasta.toISOString(),
    vence_el: nuevoHasta.toISOString(),
  };
}
