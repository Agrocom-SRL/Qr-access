import type { SuscripcionDeCuenta } from '../domain/suscripcion';

export interface PlanCambiado {
  plan: { id: string; nombre: string; cupoUsuarios: number | null };
  /** Lo que hay que cobrar por el cambio (se registra como pago de mejora). */
  diferenciaPrecio: number;
}

export interface SuscripcionesRepositorio {
  obtener: (cuentaId: string) => Promise<SuscripcionDeCuenta>;
  /** Solo sube a un plan mayor; la API rechaza lo demás con `plan.solo_mejora`. */
  cambiarPlan: (cuentaId: string, planId: string) => Promise<PlanCambiado>;
  /** El archivo de un comprobante de pago (imagen o PDF). */
  verComprobante: (comprobanteId: string) => Promise<Blob>;
  suspender: (cuentaId: string) => Promise<void>;
  reactivar: (cuentaId: string) => Promise<void>;
}
