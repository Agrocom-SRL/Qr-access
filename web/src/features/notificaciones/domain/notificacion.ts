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
  | 'apertura.fallida'
  // El sistema PROPONE restringir o suspender a un reincidente; una persona decide (ADR 0033 §4.3, ola W11).
  | 'incidente.propuesta'
  // Señales de abuso y consumo de la bolsa (ADR 0030 §4 y §5, ola W12): no cortan nada, solo avisan.
  | 'senal.uso'
  | 'bolsa.aviso'
  | 'bolsa.superada'
  | 'flujo.atipico';

/** Todos los tipos que la bandeja puede traer, en el orden del filtro. Espejo de `TIPOS_DE_NOTIFICACION` de la API. */
export const TIPOS_DE_NOTIFICACION: readonly TipoDeNotificacion[] = [
  'placa.caida_sostenida',
  'placa.desaparecida',
  'placa.lector_sin_respuesta',
  'placa.recuperada',
  'apertura.fallida',
  'incidente.propuesta',
  'senal.uso',
  'bolsa.aviso',
  'bolsa.superada',
  'flujo.atipico',
];

/** Lo que se propone hacer con un usuario reincidente (ADR 0033 §4.3). */
export const ACCIONES_PROPUESTAS = ['restringir', 'suspender', 'suspender_y_anular'] as const;
export type AccionPropuesta = (typeof ACCIONES_PROPUESTAS)[number];

/**
 * La propuesta de un incidente reincidente: el sistema NO aplica nada, la propone. Quien administra la rama
 * la aplica desde la cuenta; AGROCOM la ve aquí. Sin tokens: ids y recuentos.
 */
export interface PropuestaDeIncidente {
  accion: AccionPropuesta;
  usuarioId: string;
  usuarioEtiqueta: string | null;
  incidenteId: string;
  /** Código del tipo de incidente (`uso_masivo`, `perdida_o_robo`...); la interfaz lo traduce. */
  incidenteTipo: string;
  confirmados: number;
  minimo: number;
  ventanaDias: number;
  /** `true` si la cuenta tenía la restricción automática encendida y el sistema ya restringió al usuario. */
  aplicadaAutomaticamente: boolean;
}

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

/** Un usuario con una señal de uso (`senal.uso`). Sin tokens ni IP: ids y cantidades. */
export interface SenalDeUso {
  tipo: 'uso_masivo' | 'uso_imposible' | 'qr_reenviado' | 'pin_compartido';
  usuarioId: string;
  usuarioEtiqueta: string | null;
  gravedad: 'baja' | 'media' | 'alta';
  /** Incidente que abrió la señal; `null` si aún no se conoce. */
  incidenteId: string | null;
  /** `aaaa-mm-dd` del día local al que corresponde. */
  dia: string;
  valor: number;
  umbral: number;
}

/** La bolsa de QR de una cuenta en el aviso de porcentaje o de superación (`bolsa.*`). */
export interface BolsaDeAviso {
  /** `aaaa-mm`. */
  mes: string;
  dia: string;
  usado: number | null;
  tope: number | null;
}

/** El flujo atípico de un día (`flujo.atipico`). */
export interface FlujoDeAviso {
  dia: string;
  aperturas: number;
  usuariosActivos: number;
  porUsuario: number;
  umbralPorUsuario: number;
  base: number | null;
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
  /** Solo en `senal.uso`. */
  senal?: SenalDeUso;
  /** Solo en `bolsa.aviso` y `bolsa.superada`. */
  bolsa?: BolsaDeAviso;
  /** Solo en `flujo.atipico`. */
  flujo?: FlujoDeAviso;
  /** Solo en `incidente.propuesta`. */
  propuesta?: PropuestaDeIncidente;
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
