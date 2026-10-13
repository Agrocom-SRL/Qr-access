/** Reglas puras del inventario de placas (ADR 0025); espejo de `api/.../domain/placa.ts`. */

export type EstadoDePlaca = 'de_fabrica' | 'vinculada';
export type FiltroDeEstado = EstadoDePlaca | 'todas';

export interface Placa {
  id: string;
  /** MAC Ethernet en mayúsculas: con ella se identifica la placa. */
  mac: string;
  estado: EstadoDePlaca;
  firmware: string | null;
  ip: string | null;
  /** Último latido si está vinculada; último reclamo si no. */
  ultimoContactoEn: Date | null;
  enLinea: boolean;
  /** `false` hasta que la placa pregunta por primera vez: sin eso no se puede vincular. */
  reclamoHecho: boolean;
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

export const FILTROS_DE_ESTADO: readonly FiltroDeEstado[] = ['todas', 'de_fabrica', 'vinculada'];

/** Una placa se vincula si todavía no lo está y ya reclamó (la API responde `placa.sin_reclamo` si no). */
export function puedeVincular(placa: Placa): boolean {
  return placa.estado === 'de_fabrica' && placa.reclamoHecho;
}

/** Solo una placa vinculada se libera; una libre se da de baja. */
export function puedeLiberar(placa: Placa): boolean {
  return placa.estado === 'vinculada';
}

export function puedeDarDeBaja(placa: Placa): boolean {
  return placa.estado === 'de_fabrica';
}

/** `aa-bb-cc-00-11-22` → `AA:BB:CC:00:11:22`; `null` si no es una MAC. */
export function normalizarMac(texto: string): string | null {
  const mac = texto.trim().toUpperCase().replaceAll('-', ':');
  return /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/.test(mac) ? mac : null;
}

/** El código de 16 caracteres en grupos de 4 (`ABCD-EFGH-JKMN-PQRS`) para dictarlo o copiarlo. */
export function agruparCodigo(codigo: string): string {
  return codigo.match(/.{1,4}/g)?.join('-') ?? codigo;
}
