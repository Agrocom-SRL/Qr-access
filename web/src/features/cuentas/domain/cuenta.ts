/** Tipos y reglas puras de las cuentas cliente (A03 y A05). */

import type { EstadoDeSuscripcion } from '../../../shared/api/estados';

export type EstadoCuenta = EstadoDeSuscripcion;
export type FiltroEstado = EstadoCuenta | 'todas';

export interface PlanDeCuenta {
  id: string;
  nombre: string;
  /** Cupo de usuarios activos; `null` = sin tope. */
  cupoUsuarios: number | null;
}

export interface CuentaResumen {
  id: string;
  codigo: string;
  nombre: string;
  plan: PlanDeCuenta | null;
  usuariosActivos: number;
  venceEl: Date | null;
  estado: EstadoCuenta;
}

export type ConteoPorEstado = Record<FiltroEstado, number>;

export interface FiltrosDeCuentas {
  busqueda: string;
  estado: FiltroEstado;
  pagina: number;
}

export const POR_PAGINA_DE_CUENTAS = 10;

export const ESTADOS_DEL_FILTRO: readonly FiltroEstado[] = [
  'todas',
  'activa',
  'porVencer',
  'vencida',
  'suspendida',
  'pendientePago',
];

export interface DetalleDeCuenta {
  cuenta: { id: string; codigo: string; nombre: string; activa: boolean; clienteDesde: Date };
  empresa: {
    nit: string;
    ciudad: string;
    contacto: string;
    telefono: string;
    correo: string | null;
  } | null;
  suscripcion: {
    id: string;
    plan: { id: string; nombre: string; cupoUsuarios: number | null; precioAnual: number };
    desde: Date;
    hasta: Date;
    estado: EstadoCuenta;
    diasRestantes: number;
  } | null;
  uso: {
    usuariosActivos: number;
    sitios: number;
    puertas: number;
    dispositivosSinConexion: number;
    administradores: number;
  };
}

/** Cuántos usuarios más puede crear la cuenta antes de llegar al cupo de su plan (nunca negativo). */
export function usuariosDisponibles(usuariosActivos: number, cupo: number | null): number | null {
  return cupo === null ? null : Math.max(0, cupo - usuariosActivos);
}

export interface Dispositivo {
  id: string;
  nombre: string;
  enLinea: boolean;
  ultimaSenal: Date | null;
}

export interface PuertaDeSitio {
  id: string;
  nombre: string;
  /** Cuánto queda abierta la cerradura por cada pulso (1 a 30). */
  segundosApertura: number;
  activa: boolean;
  dispositivo: Dispositivo | null;
}

export interface SitioConPuertas {
  id: string;
  nombre: string;
  direccion: string | null;
  /** Zona IANA en la que se evalúan los horarios del sitio. */
  zonaHoraria: string;
  activo: boolean;
  puertas: PuertaDeSitio[];
}

export interface DatosDeSitio {
  nombre: string;
  direccion: string;
  zonaHoraria: string;
}

export interface DatosDePuerta {
  nombre: string;
  segundosApertura: number;
}
