/**
 * Estado de la suscripción de una cuenta tal como lo manda la API (`por_vencer`, `pendiente_pago`) y
 * como lo usa la interfaz (`porVencer`, `pendientePago`). Un solo lugar para los cuatro módulos
 * (cuentas, pagos, resumen y suscripciones) que lo reciben.
 */
export type EstadoDto = 'activa' | 'por_vencer' | 'vencida' | 'suspendida' | 'pendiente_pago';
export type EstadoDeSuscripcion =
  'activa' | 'porVencer' | 'vencida' | 'suspendida' | 'pendientePago';

export const ESTADO_DESDE_DTO: Readonly<Record<EstadoDto, EstadoDeSuscripcion>> = {
  activa: 'activa',
  por_vencer: 'porVencer',
  vencida: 'vencida',
  suspendida: 'suspendida',
  pendiente_pago: 'pendientePago',
};

export const ESTADO_HACIA_DTO: Readonly<Record<EstadoDeSuscripcion, EstadoDto>> = {
  activa: 'activa',
  porVencer: 'por_vencer',
  vencida: 'vencida',
  suspendida: 'suspendida',
  pendientePago: 'pendiente_pago',
};
