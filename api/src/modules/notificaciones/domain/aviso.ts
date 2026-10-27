/**
 * Lo que una notificación dice y a quién va (ADR 0030 §5 y §6, ADR 0031 §18). Puro: no toca la base.
 */

export const TIPOS_DE_AVISO = [
  'placa.caida_sostenida',
  'placa.desaparecida',
  'placa.lector_sin_respuesta',
  // La puerta recibió la orden de abrir y no se abrió, varias veces (ADR 0031 §18, ola W10).
  'apertura.fallida',
] as const;
export type TipoDeAviso = (typeof TIPOS_DE_AVISO)[number];

/** Los avisos que cierran un incidente con una constancia informativa (p. ej. «la placa volvió»). */
export const TIPOS_INFORMATIVOS = ['placa.recuperada'] as const;

export type TipoDeNotificacion = TipoDeAviso | (typeof TIPOS_INFORMATIVOS)[number];
export const TIPOS_DE_NOTIFICACION: readonly TipoDeNotificacion[] = [
  ...TIPOS_DE_AVISO,
  ...TIPOS_INFORMATIVOS,
];

export type Severidad = 'info' | 'aviso' | 'critica';

/** `cuenta` = el propietario de la cuenta; `plataforma` = el equipo AGROCOM. */
export type Audiencia = 'cuenta' | 'plataforma';

/** El permiso que hace destinatario a un usuario: el destino sale del permiso, no de un nombre de rol. */
export const PERMISO_DE_DESTINATARIO: Readonly<Record<Audiencia, string>> = {
  cuenta: 'notificaciones.aviso.ver',
  plataforma: 'notificaciones.aviso_plataforma.ver',
};

/** Una placa dentro de un aviso agrupado. Nada sensible: ni clave, ni MAC, ni token. */
export interface PlacaDeAviso {
  readonly dispositivo_id: string;
  readonly puerta_id: string;
  readonly puerta_nombre: string;
  /** Desde cuándo está así (ISO 8601 UTC): el último latido o el último cambio del lector. */
  readonly desde: string | null;
  /** Solo en `apertura.fallida`: cuántas aperturas fallaron en la ventana en esta puerta. */
  readonly fallos?: number;
  /** Solo en `apertura.fallida`: la causa de la última falla (`puerta_no_abrio`, `sin_respuesta`...). */
  readonly causa?: string | null;
}

export interface DatosDeAviso {
  readonly cuenta: { readonly id: string; readonly codigo: string; readonly nombre: string };
  readonly sitio: { readonly id: string; readonly nombre: string } | null;
  readonly placas: PlacaDeAviso[];
}

/**
 * La fotografía de un grupo (p. ej. «placas caídas del sitio 12») en un instante. El detector la deja en
 * la cola cada vez que la membresía del grupo cambia; quien la entrega la aplica de forma idempotente:
 * con miembros abre o actualiza el incidente del destinatario, sin miembros lo cierra.
 */
export interface AvisoAgrupado {
  readonly tipo: TipoDeAviso;
  readonly severidad: Severidad;
  readonly audiencia: Audiencia;
  /** Clave del grupo; un destinatario tiene a lo sumo un incidente abierto por clave. */
  readonly agrupacion: string;
  readonly sitioId: string | null;
  /** Ids de quienes forman el grupo ahora (para saber si llegó alguien nuevo). Vacío = resuelto. */
  readonly miembros: readonly string[];
  readonly datos: DatosDeAviso;
  /** Al resolverse el incidente, deja además esta constancia informativa. */
  readonly alResolver: {
    readonly tipo: (typeof TIPOS_INFORMATIVOS)[number];
    readonly severidad: Severidad;
  } | null;
}

export interface IncidenteAbierto {
  readonly id: string;
  /** Todos los que alguna vez formaron parte del incidente. */
  readonly miembros: readonly string[];
}

export type Decision =
  | { readonly accion: 'abrir' }
  | {
      readonly accion: 'actualizar';
      /** Los avisados antes más los nuevos. */
      readonly miembros: readonly string[];
      /** Llegó alguien que el destinatario aún no había visto. */
      readonly hayNovedad: boolean;
    }
  | { readonly accion: 'cerrar' }
  | { readonly accion: 'nada' };

/**
 * Qué hacer con un aviso agrupado dado el incidente abierto del destinatario (o `null`).
 * - Con miembros y sin incidente: se abre (UNA notificación por grupo, con todos sus miembros).
 * - Con miembros y con incidente: se actualiza el mismo; si llegó alguien nuevo, vuelve a ser noticia.
 * - Sin miembros: se cierra el incidente (recuperación), si lo había.
 */
export function decidir(
  incidente: IncidenteAbierto | null,
  aviso: Pick<AvisoAgrupado, 'miembros'>,
): Decision {
  if (aviso.miembros.length === 0)
    return incidente === null ? { accion: 'nada' } : { accion: 'cerrar' };
  if (incidente === null) return { accion: 'abrir' };
  const conocidos = new Set(incidente.miembros);
  const nuevos = aviso.miembros.filter((miembro) => !conocidos.has(miembro));
  return {
    accion: 'actualizar',
    miembros: [...incidente.miembros, ...nuevos],
    hayNovedad: nuevos.length > 0,
  };
}

/**
 * Intentos de entrega fallidos (no transitorios) antes de dar el mensaje por `fallida`. Con la espera creciente
 * (30 s, 1 min, 2 min... hasta 1 h) son cerca de 2 h de reintentos; después, el re-drive de las `fallida`.
 */
export const INTENTOS_MAXIMOS = 8;
const ESPERA_BASE_SEGUNDOS = 30;
const ESPERA_MAXIMA_SEGUNDOS = 3600;

/** Espera antes del próximo intento tras `intentos` fallos: 30 s, 1 min, 2 min, 4 min... hasta 1 h. */
export function esperaTrasFallo(intentos: number): number {
  const exponente = Math.max(0, intentos - 1);
  return Math.min(ESPERA_BASE_SEGUNDOS * 2 ** exponente, ESPERA_MAXIMA_SEGUNDOS);
}

/** Espera tras un fallo transitorio (bloqueo, pool lleno): no cuenta como intento y se reintenta pronto. */
export const ESPERA_TRAS_FALLO_TRANSITORIO_SEGUNDOS = ESPERA_BASE_SEGUNDOS;

/**
 * Re-drive de las `fallida`: pasadas las horas de espera vuelven a la cola (con un solo intento más antes de
 * volver a `fallida`), mientras el mensaje tenga menos de los días indicados: después el aviso ya no sirve y
 * queda para revisión humana. Supuestos de la ola W9, no del documento funcional.
 */
export const ESPERA_DE_REINTENTO_DE_FALLIDA_HORAS = 6;
export const VIGENCIA_DE_REINTENTO_DE_FALLIDA_DIAS = 3;

/**
 * Enfriamiento de un incidente: si un grupo se recupera y vuelve a caer dentro de estos minutos, se REABRE el
 * incidente cerrado en vez de abrir otro (un dispositivo que parpadea no llena la bandeja de abrir y cerrar).
 */
export const ENFRIAMIENTO_DE_INCIDENTE_MINUTOS = 60;
