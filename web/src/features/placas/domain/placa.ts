/** Reglas puras del inventario de placas (ADR 0026); espejo de `api/.../domain/placa.ts`. */

/** `detectada`: se anunció sola; `por_confirmar`: se pidió vincularla y espera su botón. */
export type EstadoDePlaca = 'detectada' | 'por_confirmar' | 'vinculada';
export type FiltroDeEstado = EstadoDePlaca | 'todas';

export interface Placa {
  id: string;
  /** MAC Ethernet en mayúsculas: con ella se identifica la placa. */
  mac: string;
  estado: EstadoDePlaca;
  firmware: string | null;
  ip: string | null;
  /** Último latido si está vinculada; último anuncio si no. */
  ultimoContactoEn: Date | null;
  enLinea: boolean;
  /** Hasta cuándo espera el botón de la placa; solo en `por_confirmar`. */
  porConfirmarHasta: Date | null;
  dispositivo: { id: string; nombre: string } | null;
  cuenta: { id: string; codigo: string; nombre: string } | null;
  puerta: { id: string; nombre: string } | null;
}

export interface FiltrosDePlacas {
  busqueda: string;
  estado: FiltroDeEstado;
  pagina: number;
}

export const POR_PAGINA_DE_PLACAS = 10;

export const FILTROS_DE_ESTADO: readonly FiltroDeEstado[] = [
  'todas',
  'detectada',
  'por_confirmar',
  'vinculada',
];

/** Una placa detectada se vincula; la que ya espera su botón se cancela y se vuelve a pedir. */
export function puedeVincular(placa: Placa): boolean {
  return placa.estado === 'detectada';
}

export function puedeCancelarVinculo(placa: Placa): boolean {
  return placa.estado === 'por_confirmar';
}

/** Solo una placa vinculada se libera; una libre se da de baja. */
export function puedeLiberar(placa: Placa): boolean {
  return placa.estado === 'vinculada';
}

export function puedeDarDeBaja(placa: Placa): boolean {
  return placa.estado !== 'vinculada';
}

/** Minutos que le quedan a la ventana de confirmación (mínimo 0, redondeado hacia arriba). */
export function minutosRestantes(hasta: Date, ahora: Date): number {
  return Math.max(0, Math.ceil((hasta.getTime() - ahora.getTime()) / 60_000));
}
