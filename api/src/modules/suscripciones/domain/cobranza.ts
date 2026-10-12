import type { EstadoDeSuscripcion } from './estado.js';

/**
 * Ventanas de la pantalla de Cobranza (A08): acumulativas hacia adelante, más las ya vencidas y las
 * cuentas nuevas que todavía no pagaron su alta (`pendientes`).
 */
export type VentanaDeCobranza = 'd30' | 'd60' | 'd90' | 'vencidas' | 'pendientes';

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
  if (ventana === 'pendientes') return datos.estado === 'pendiente_pago';
  if (datos.estado === 'suspendida' || datos.estado === 'pendiente_pago') return false;
  if (ventana === 'vencidas') return datos.estado === 'vencida';
  if (datos.estado === 'vencida') return false;
  return datos.diasRestantes <= DIAS_POR_VENTANA[ventana];
}

export type EstadoDePago = 'pendiente' | 'sin_pagar' | 'por_activar';

/**
 * Estado del pago de la próxima renovación: pendiente mientras la suscripción corre y sin pagar
 * una vez vencida (la cuenta ya está rechazando accesos). Registrar el pago renueva (ADR 0022).
 * `por_activar`: la cuenta nueva espera su primer pago para empezar a operar.
 */
export function estadoDePago(estado: EstadoDeSuscripcion): EstadoDePago {
  if (estado === 'pendiente_pago') return 'por_activar';
  return estado === 'vencida' ? 'sin_pagar' : 'pendiente';
}
