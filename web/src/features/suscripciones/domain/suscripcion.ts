/** Tipos y reglas puras de la suscripción de una cuenta (A05b, A06): ADR 0017 y 0022. */

import type { EstadoDeSuscripcion } from '../../../shared/api/estados';

export type EstadoSuscripcion = EstadoDeSuscripcion;
export type EstadoPago = 'pendiente' | 'sinPagar' | 'porActivar';
export type TipoDePago = 'alta' | 'renovacion' | 'mejoraDePlan';
export type MedioDePago = 'transferencia' | 'qr' | 'efectivo';

export const MEDIOS_DE_PAGO: readonly MedioDePago[] = ['efectivo', 'transferencia', 'qr'];

export interface PlanContratado {
  id: string;
  nombre: string;
  cupoUsuarios: number | null;
  precioAnual: number;
}

export interface PagoDeCuenta {
  id: string;
  tipo: TipoDePago;
  plan: string;
  monto: number;
  /** `aaaa-mm-dd`. */
  fechaPago: string;
  medio: MedioDePago;
  referencia: string;
  /** El archivo del comprobante, que se baja con `verComprobante`. */
  comprobanteId: string | null;
  periodoDesde: Date;
  periodoHasta: Date;
  registro: { id: string; nombre: string } | null;
}

export interface SuscripcionDeCuenta {
  cuenta: { id: string; codigo: string; nombre: string };
  suscripcion: {
    id: string;
    plan: PlanContratado;
    desde: Date;
    hasta: Date;
    estado: EstadoSuscripcion;
    diasRestantes: number;
  };
  /** `null` si la suscripción está suspendida. */
  proximoPago: EstadoPago | null;
  pagos: readonly PagoDeCuenta[];
}

/** Lo mínimo de un plan para decidir si es una mejora. */
export interface PlanComparable {
  id: string;
  nombre: string;
  cupoUsuarios: number | null;
  precioAnual: number;
}

/** Sin tope (`null`) es el cupo más alto; un plan sin tope no tiene mejora posible. */
export function esMejora(actual: PlanComparable, nuevo: PlanComparable): boolean {
  if (actual.cupoUsuarios === null) return false;
  return nuevo.cupoUsuarios === null || nuevo.cupoUsuarios > actual.cupoUsuarios;
}

/**
 * Los planes a los que puede pasar la cuenta: solo los de mayor cupo, del más chico al más grande.
 * Nunca se baja de plan en mitad de la suscripción: no se devuelve dinero (ADR 0022).
 */
export function opcionesDeMejora<P extends PlanComparable>(
  planes: readonly P[],
  actual: PlanComparable,
): P[] {
  return planes
    .filter((plan) => esMejora(actual, plan))
    .sort((a, b) => (a.cupoUsuarios ?? Infinity) - (b.cupoUsuarios ?? Infinity));
}

/** Lo que se cobra por subir de plan: la diferencia de precio anual. */
export function diferenciaDePrecio(actual: PlanComparable, nuevo: PlanComparable): number {
  return Math.round((nuevo.precioAnual - actual.precioAnual) * 100) / 100;
}

/** ¿Se puede renovar o cambiar de plan? Una suscripción suspendida primero se reactiva. */
export function admiteCambios(estado: EstadoSuscripcion): boolean {
  return estado !== 'suspendida' && estado !== 'pendientePago';
}
