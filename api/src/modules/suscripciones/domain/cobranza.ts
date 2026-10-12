import type { EstadoDeSuscripcion } from './estado.js';

/** Ventanas de la pantalla de Cobranza (A08): acumulativas hacia adelante, más las ya vencidas. */
export type VentanaDeCobranza = 'd30' | 'd60' | 'd90' | 'vencidas';

export const DIAS_POR_VENTANA = { d30: 30, d60: 60, d90: 90 } as const;

export interface DatosDeCobranza {
  readonly estado: EstadoDeSuscripcion;
  /** Negativo si ya venció. */
  readonly diasRestantes: number;
}

/**
 * ¿Entra la suscripción en la ventana? Las suspendidas no se cobran. `d30` incluye lo que vence
 * en 30 días o menos (y todavía no venció); `d60` y `d90` son acumulativas.
 */
export function entraEnVentana(datos: DatosDeCobranza, ventana: VentanaDeCobranza): boolean {
  if (datos.estado === 'suspendida') return false;
  if (ventana === 'vencidas') return datos.estado === 'vencida';
  if (datos.estado === 'vencida') return false;
  return datos.diasRestantes <= DIAS_POR_VENTANA[ventana];
}

export type EstadoDePago = 'pendiente' | 'sin_pagar';

/**
 * Estado del pago de la próxima renovación: pendiente mientras la suscripción corre y sin pagar
 * una vez vencida (la cuenta ya está rechazando accesos). Registrar el pago renueva (ADR 0022).
 */
export function estadoDePago(estado: EstadoDeSuscripcion): EstadoDePago {
  return estado === 'vencida' ? 'sin_pagar' : 'pendiente';
}
