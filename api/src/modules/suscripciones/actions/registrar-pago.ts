import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { inicioDelDia, sumarMeses } from '../../../platform/tiempo/fechas.js';
import {
  RepositorioDeComprobantes,
  RepositorioDePagos,
  RepositorioDeSuscripciones,
  type MedioDePago,
  type SuscripcionActualFila,
  type TipoDePago,
} from '../repository.js';
import { suscripcionActualODeLaCuenta } from './contexto-de-suscripcion.js';

export interface DatosDePago {
  readonly tipo: TipoDePago;
  readonly monto: number;
  readonly fechaPago: string;
  readonly medio: MedioDePago;
  readonly referencia: string;
  /** El comprobante del pago (ADR 0024). */
  readonly comprobanteId?: string | undefined;
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
 * - `alta`: el primer pago de una cuenta nueva (pendiente de pago): la activa y el año corre desde la
 *   fecha del pago. Es el único pago que acepta una cuenta pendiente, y solo una pendiente lo acepta.
 * Una suscripción suspendida no se renueva: primero se reactiva.
 */
export async function ejecutar(pool: Pool, datos: DatosDePago): Promise<PagoRegistrado> {
  if (datos.comprobanteId !== undefined) {
    const comprobante = await new RepositorioDeComprobantes(pool).buscarPorId(datos.comprobanteId);
    if (comprobante === null) throw new ErrorDeDominio('comprobante.no_encontrado', 422);
  }
  const suscripcion = await suscripcionActualODeLaCuenta(pool);
  const pendiente = suscripcion.estado === 'pendiente';
  if (pendiente !== (datos.tipo === 'alta')) {
    throw new ErrorDeDominio(
      pendiente ? 'suscripcion.pendiente_de_pago' : 'suscripcion.ya_activa',
      422,
    );
  }
  if (suscripcion.estado === 'suspendida') {
    throw new ErrorDeDominio('suscripcion.suspendida', 422);
  }
  if (pendiente) return registrarAlta(pool, suscripcion, datos);
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
      comprobanteId: datos.comprobanteId,
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

/** El primer pago: la suscripción empieza el día del pago y dura 12 meses. */
async function registrarAlta(
  pool: Pool,
  suscripcion: SuscripcionActualFila,
  datos: DatosDePago,
): Promise<PagoRegistrado> {
  const desde = inicioDelDia(datos.fechaPago);
  const hasta = sumarMeses(desde, 12);
  const pagoId = await enTransaccion(pool, async (tx) => {
    await new RepositorioDeSuscripciones(pool).activar(tx, suscripcion.id, desde, hasta);
    return new RepositorioDePagos(pool).registrar(tx, {
      suscripcionId: suscripcion.id,
      planId: suscripcion.plan_id,
      tipo: 'alta',
      monto: datos.monto,
      fechaPago: datos.fechaPago,
      medio: datos.medio,
      referencia: datos.referencia,
      comprobanteId: datos.comprobanteId,
      periodoDesde: desde,
      periodoHasta: hasta,
    });
  });
  return {
    id: pagoId,
    tipo: 'alta',
    periodo_desde: desde.toISOString(),
    periodo_hasta: hasta.toISOString(),
    vence_el: hasta.toISOString(),
  };
}
