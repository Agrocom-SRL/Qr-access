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
  cuenta: {
    id: string;
    codigo: string;
    nombre: string;
    activa: boolean;
    clienteDesde: Date;
    /** Cuántos Miembros puede tener cada Titular de la cuenta (ADR 0028 §6). */
    maxMiembrosPorTitular: number;
  };
  /** Datos de la empresa; `nit`, `telefono` y `correo` faltan en cuentas que no los cargaron. */
  empresa: {
    nit: string | null;
    ciudad: string;
    /** Nombre completo de la persona responsable, tal como lo muestra la ficha. */
    contacto: string;
    contactoNombre: string;
    contactoApellido: string;
    telefono: string | null;
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

/** Tope que puede fijar AGROCOM para los Miembros de un Titular (el mismo que valida la API). */
export const MAX_MIEMBROS_POR_TITULAR = 500;

/** Un tope válido es un entero de 1 a 500. */
export function topeDeMiembrosValido(valor: number): boolean {
  return Number.isInteger(valor) && valor >= 1 && valor <= MAX_MIEMBROS_POR_TITULAR;
}

/** Los 4 caracteres del PIN que se pueden elegir al sumar un Administrador (ADR 0018). */
const SUFIJO_DE_PIN = /^[A-Za-z0-9]{4}$/;

export function sufijoDePinValido(sufijo: string): boolean {
  return SUFIJO_DE_PIN.test(sufijo);
}

/** Un Administrador de la cuenta con lo que cuelga de él (ADR 0028 §1). */
export interface RamaDeAdministrador {
  id: string;
  etiqueta: string;
  guardias: readonly { id: string; etiqueta: string }[];
  titulares: readonly {
    id: string;
    etiqueta: string;
    unidad: string | null;
    miembros: number;
  }[];
}

/** A quién se puede mover algo: todos los Administradores de la cuenta menos el que ya lo tiene. */
export function destinosDeReasignacion(
  ramas: readonly RamaDeAdministrador[],
  administradorActualId: string,
): readonly RamaDeAdministrador[] {
  return ramas.filter((rama) => rama.id !== administradorActualId);
}

/** Uso que un usuario hizo de sus QR en la ventana (ADR 0028 §4). Informativo. */
export interface UsoDeUsuario {
  id: string;
  etiqueta: string;
  rol: string | null;
  unidad: string | null;
  qrGenerados: number;
  qrUsados: number;
  maxQrEnUnDia: number;
  /** El último QR que generó, de cualquier fecha; `null` si nunca generó uno. */
  ultimoQrEn: Date | null;
  inactivo: boolean;
  ruidoso: boolean;
}

export interface TitularConMiembros {
  id: string;
  etiqueta: string;
  unidad: string | null;
  miembros: number;
  tope: number;
  porcentaje: number;
  cercaDelTope: boolean;
}

/**
 * El uso de los usuarios de una cuenta tal como lo calcula la API: los umbrales son fijos (30 días
 * sin QR; más de 10 QR en un día) y el panel no calcula nada, solo lo muestra.
 */
export interface EstadisticasDeUsuarios {
  ventanaDias: number;
  umbralInactivoDias: number;
  umbralRuidosoPorDia: number;
  usuarios: readonly UsoDeUsuario[];
  titulares: readonly TitularConMiembros[];
  /** Cuántos usuarios cuelgan de cada Administrador (el cupo de su rama). */
  ramas: readonly { id: string; etiqueta: string; usuarios: number }[];
}

/** Los que no generaron ningún QR en la ventana: candidatos a baja. */
export function inactivosDe(e: EstadisticasDeUsuarios): readonly UsoDeUsuario[] {
  return e.usuarios.filter((u) => u.inactivo);
}

/** Los que generan QR a cada rato: candidatos a revisión. */
export function ruidososDe(e: EstadisticasDeUsuarios): readonly UsoDeUsuario[] {
  return e.usuarios.filter((u) => u.ruidoso);
}

/** Los Titulares que ya usan casi todo su tope de Miembros. */
export function titularesCercaDelTope(e: EstadisticasDeUsuarios): readonly TitularConMiembros[] {
  return e.titulares.filter((t) => t.cercaDelTope);
}
