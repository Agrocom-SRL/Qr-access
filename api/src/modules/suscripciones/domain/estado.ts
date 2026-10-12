/** Estado visible de la suscripción de una cuenta (A03, BadgeSuscripcion). */
export type EstadoDeSuscripcion = 'activa' | 'por_vencer' | 'vencida' | 'suspendida';

/** Días que faltan para el vencimiento a partir de los cuales una suscripción es "por vencer". */
export const DIAS_PARA_POR_VENCER = 30;

export interface DatosDeEstado {
  /** Lo que guarda `suscripciones.estado`; `vencida` se calcula, no se guarda. */
  readonly estado: 'vigente' | 'suspendida' | 'vencida';
  readonly hasta: Date;
}

const DIA_MS = 86_400_000;

/** Días enteros hacia arriba hasta `hasta`; negativo si ya venció. */
export function diasRestantes(hasta: Date, ahora: Date): number {
  return Math.ceil((hasta.getTime() - ahora.getTime()) / DIA_MS);
}

/**
 * Estado de una suscripción en `ahora`: suspendida manda sobre todo; vencida si ya pasó `hasta`;
 * por vencer si faltan 30 días o menos; activa en el resto (RF-06, README del handoff).
 */
export function estadoDeSuscripcion(datos: DatosDeEstado, ahora: Date): EstadoDeSuscripcion {
  if (datos.estado === 'suspendida') return 'suspendida';
  if (datos.estado === 'vencida' || datos.hasta.getTime() <= ahora.getTime()) return 'vencida';
  return diasRestantes(datos.hasta, ahora) <= DIAS_PARA_POR_VENCER ? 'por_vencer' : 'activa';
}
