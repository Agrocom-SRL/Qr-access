import type { EstadoDeSuscripcion } from '../../../shared/api/estados';

/** Las series de las gráficas del Resumen y de Cobranza (A02, A08). */
export interface Estadisticas {
  /** Últimos 12 meses (`aaaa-mm`), con ceros donde no hubo pagos. */
  cobradoPorMes: readonly { mes: string; monto: number; pagos: number }[];
  altasPorMes: readonly { mes: string; cuentas: number }[];
  cuentasPorEstado: Readonly<Record<EstadoDeSuscripcion, number>>;
  cuentasPorPlan: readonly { plan: string; cuentas: number; cupoUsuarios: number | null }[];
  /** Últimos 14 días (`aaaa-mm-dd`), con ceros donde no hubo intentos. */
  accesosPorDia: readonly { dia: string; permitidos: number; rechazados: number }[];
}

/** El orden en que se cuentan los estados: de lo sano a lo que pide atención. */
export const ESTADOS_EN_ORDEN: readonly EstadoDeSuscripcion[] = [
  'activa',
  'porVencer',
  'pendientePago',
  'vencida',
  'suspendida',
];

export function totalDeCuentas(estados: Readonly<Record<EstadoDeSuscripcion, number>>): number {
  return Object.values(estados).reduce((suma, cantidad) => suma + cantidad, 0);
}
