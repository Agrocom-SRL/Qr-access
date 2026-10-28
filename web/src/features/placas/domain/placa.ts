/** Reglas puras del inventario de placas (ADR 0026); espejo de `api/.../domain/placa.ts`. */

/** `detectada`: se anunció sola; `por_confirmar`: se pidió vincularla y espera su botón. */
export type EstadoDePlaca = 'detectada' | 'por_confirmar' | 'vinculada';
export type FiltroDeEstado = EstadoDePlaca | 'todas';
/** Para dar con la que falla: las que dejaron de reportar. */
export type FiltroDeConexion = 'todas' | 'en_linea' | 'sin_conexion';

/**
 * Estado de una placa vinculada según su último latido (ADR 0031 §18): `caida_sostenida` a los 15
 * minutos sin latido y `desaparecida` a las 2 horas.
 */
export type EstadoDeConexion = 'en_linea' | 'sin_conexion' | 'caida_sostenida' | 'desaparecida';
/** Lo que informó el último latido sobre el contacto de la puerta. */
export type SensorDePuerta = 'abierta' | 'cerrada' | 'sin_sensor';
/** Nivel del pin del sensor con la puerta ABIERTA; la polaridad se confirma en campo. */
export type NivelAbierto = 'alto' | 'bajo';

export interface SensorConfigurado {
  instalado: boolean;
  nivelAbierto: NivelAbierto;
}

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
  /** Estado de conexión por latido; `null` si no está vinculada o nunca envió un latido. */
  estadoConexion: EstadoDeConexion | null;
  /** Lo que informó el último latido sobre el lector QR; `null` si la placa no lo informa. */
  lectorResponde: boolean | null;
  /** En línea pero sin lecturas en 24 h: marca informativa, sin aviso. */
  enObservacion: boolean;
  sensorPuerta: SensorDePuerta | null;
  /** Configuración del sensor; `null` si no está vinculada. */
  sensorConfigurado: SensorConfigurado | null;
  /** La puerta está en el grupo de «aperturas que fallan» (ADR 0031 §18). */
  aperturaFallida: boolean;
  /** Hasta cuándo espera el botón de la placa; solo en `por_confirmar`. */
  porConfirmarHasta: Date | null;
  dispositivo: { id: string; nombre: string } | null;
  cuenta: { id: string; codigo: string; nombre: string } | null;
  puerta: { id: string; nombre: string } | null;
}

export interface FiltrosDePlacas {
  busqueda: string;
  estado: FiltroDeEstado;
  conexion: FiltroDeConexion;
  pagina: number;
}

export const POR_PAGINA_DE_PLACAS = 10;

export const FILTROS_DE_CONEXION: readonly FiltroDeConexion[] = [
  'todas',
  'en_linea',
  'sin_conexion',
];

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

/**
 * El estado de conexión que se muestra: el de la API cuando la placa está vinculada; si no, el
 * anuncio (en línea o no), que es lo único que se sabe de una placa sin vínculo.
 */
export function estadoDeConexionDe(placa: Placa): EstadoDeConexion {
  return placa.estadoConexion ?? (placa.enLinea ? 'en_linea' : 'sin_conexion');
}

/** El sensor se configura en la placa en servicio (la API responde 409 si no hay dispositivo). */
export function puedeConfigurarSensor(placa: Placa): boolean {
  return placa.dispositivo !== null;
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
