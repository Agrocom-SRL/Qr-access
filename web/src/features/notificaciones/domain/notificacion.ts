/**
 * Avisos de la bandeja de AGROCOM (ADR 0030 §6 y ADR 0031 §18): los de placas y las aperturas que
 * fallan, de todas las cuentas. Espejo de `api/.../notificaciones/domain/aviso.ts`; lo que cambie
 * allá se refleja acá.
 */

export type TipoDeNotificacion =
  | 'placa.caida_sostenida'
  | 'placa.desaparecida'
  | 'placa.lector_sin_respuesta'
  | 'placa.recuperada'
  | 'apertura.fallida';

export type Severidad = 'info' | 'aviso' | 'critica';

/** Las causas que la placa informa de una apertura que no se confirmó (ADR 0031 §18). */
export const CAUSAS_DE_APERTURA = [
  'puerta_no_abrio',
  'puerta_no_cerro',
  'rele_no_accionado',
  'sin_sensor',
  'sin_respuesta',
] as const;
export type CausaDeApertura = (typeof CAUSAS_DE_APERTURA)[number];

/** Una placa dentro del aviso, con su puerta. Nunca trae la MAC ni claves. */
export interface PlacaDeNotificacion {
  dispositivoId: string;
  puertaId: string;
  puertaNombre: string;
  /** Desde cuándo viene la novedad; `null` si la API no lo informa. */
  desde: Date | null;
  /** Solo en `apertura.fallida`: cuántas aperturas seguidas no se confirmaron. */
  fallos: number | null;
  /** Solo en `apertura.fallida`: la causa que informó la placa, si la conoce el panel. */
  causa: CausaDeApertura | null;
}

export interface Notificacion {
  id: string;
  tipo: TipoDeNotificacion;
  severidad: Severidad;
  cuenta: { id: string; codigo: string; nombre: string };
  /** `null` cuando el aviso es de la cuenta entera y no de un sitio. */
  sitio: { id: string; nombre: string } | null;
  leida: boolean;
  placas: PlacaDeNotificacion[];
  novedadEn: Date;
  creadaEn: Date;
}

/** `no_leidas` = las que aún no abrió; `todas` = las que no descartó. */
export type FiltroDeNotificaciones = 'no_leidas' | 'todas';

export interface GrupoDeSitio {
  clave: string;
  cuenta: Notificacion['cuenta'];
  sitio: Notificacion['sitio'];
  notificaciones: Notificacion[];
}

export const POR_PAGINA_DE_NOTIFICACIONES = 10;

/** Cada cuánto se consulta la bandeja: un aviso nuevo llega sin recargar el panel. */
export const REFRESCO_DE_NOTIFICACIONES_MS = 30_000;

/**
 * Agrupa los avisos por sitio dentro de su cuenta, en el orden en que llegan (la API ordena por
 * novedad). Un aviso sin sitio va en el grupo de la cuenta entera.
 */
export function agruparPorSitio(notificaciones: readonly Notificacion[]): GrupoDeSitio[] {
  const grupos = new Map<string, GrupoDeSitio>();
  for (const notificacion of notificaciones) {
    const clave = `${notificacion.cuenta.id}-${notificacion.sitio?.id ?? 'cuenta'}`;
    const grupo = grupos.get(clave) ?? {
      clave,
      cuenta: notificacion.cuenta,
      sitio: notificacion.sitio,
      notificaciones: [],
    };
    grupo.notificaciones.push(notificacion);
    grupos.set(clave, grupo);
  }
  return [...grupos.values()];
}

/**
 * Cuántos avisos nuevos hay entre dos lecturas del contador. La primera lectura no avisa: lo que
 * ya estaba sin leer no es novedad.
 */
export function nuevasDesde(anterior: number | undefined, actual: number): number {
  return anterior === undefined ? 0 : Math.max(0, actual - anterior);
}
