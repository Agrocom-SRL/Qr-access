/** El tablero de la plataforma (A02). */
import type { EventoBitacora } from '../../bitacora';

export type EstadoRenovacion = 'activa' | 'porVencer' | 'vencida' | 'suspendida';

export interface RenovacionProxima {
  cuenta: { id: string; codigo: string; nombre: string };
  venceEl: Date;
  /** Negativo si ya venció. */
  diasRestantes: number;
  monto: number;
  estado: EstadoRenovacion;
}

export interface Resumen {
  actualizadoEn: Date;
  cuentas: { activas: number; total: number; porVencer: number };
  usuarios: { enUso: number; cupoVendido: number };
  porVencer30: { cuentas: number; monto: number };
  ingresosEsperados: number;
  renovaciones: readonly RenovacionProxima[];
  ultimasAcciones: readonly EventoBitacora[];
}

/** Porcentaje entero de cupo usado; 0 si no se vendió cupo. */
export function porcentajeDeUso(enUso: number, cupo: number): number {
  return cupo <= 0 ? 0 : Math.round((enUso / cupo) * 100);
}
