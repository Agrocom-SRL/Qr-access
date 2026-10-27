/**
 * Incidentes de uso de una cuenta (ADR 0033 §4): un caso raro que abre el sistema o registra una persona.
 * AGROCOM los ve en solo lectura; quien administra la rama de la cuenta los confirma o descarta.
 * Nada de esto corta el acceso por sí solo.
 */

export const TIPOS_DE_INCIDENTE = [
  'uso_masivo',
  'uso_imposible',
  'pin_compartido',
  'qr_reenviado',
  'generacion_ruidosa',
  'perdida_o_robo',
  'otro',
] as const;
export type TipoDeIncidente = (typeof TIPOS_DE_INCIDENTE)[number];

export const GRAVEDADES_DE_INCIDENTE = ['baja', 'media', 'alta'] as const;
export type GravedadDeIncidente = (typeof GRAVEDADES_DE_INCIDENTE)[number];

export const ORIGENES_DE_INCIDENTE = ['sistema', 'persona'] as const;
export type OrigenDeIncidente = (typeof ORIGENES_DE_INCIDENTE)[number];

/** `sin_resolver` = nadie lo resolvió; los demás son el resultado de la última resolución. */
export const ESTADOS_DE_INCIDENTE = [
  'sin_resolver',
  'pendiente',
  'confirmado',
  'descartado',
] as const;
export type EstadoDeIncidente = (typeof ESTADOS_DE_INCIDENTE)[number];

export const RESULTADOS_DE_RESOLUCION = ['pendiente', 'confirmado', 'descartado'] as const;
export type ResultadoDeResolucion = (typeof RESULTADOS_DE_RESOLUCION)[number];

export const POR_PAGINA_DE_INCIDENTES = 20;

/** Una persona de la cuenta tal como la muestra la API: id y etiqueta (la etiqueta puede faltar). */
export interface PersonaDeIncidente {
  id: string;
  etiqueta: string | null;
}

export interface ResolucionDeIncidente {
  resultado: ResultadoDeResolucion;
  motivo: string | null;
  resueltoPor: PersonaDeIncidente;
  resueltaEn: Date;
}

export interface EvidenciaDeIncidente {
  qrIds: readonly string[];
  eventoAccesoIds: readonly string[];
  eventoLimiteIds: readonly string[];
}

export interface Incidente {
  id: string;
  usuario: PersonaDeIncidente;
  tipo: TipoDeIncidente;
  gravedad: GravedadDeIncidente;
  origen: OrigenDeIncidente;
  /** Quién lo registró a mano; `null` si lo abrió el sistema. */
  registradoPor: PersonaDeIncidente | null;
  /** Texto libre acotado: se muestra como texto plano. */
  descripcion: string | null;
  /** Solo ids y recuentos; nunca un token. */
  evidencia: EvidenciaDeIncidente;
  estado: EstadoDeIncidente;
  resolucion: ResolucionDeIncidente | null;
  ocurridoEn: Date;
  creadoEn: Date;
}

export interface FiltrosDeIncidentes {
  tipo: TipoDeIncidente | 'todos';
  origen: OrigenDeIncidente | 'todos';
  estado: EstadoDeIncidente | 'todos';
  pagina: number;
}

export const FILTROS_INICIALES_DE_INCIDENTES: FiltrosDeIncidentes = {
  tipo: 'todos',
  origen: 'todos',
  estado: 'todos',
  pagina: 1,
};

/** Tono visual de cada gravedad. El texto de la gravedad siempre va con él (nunca solo color). */
export const TONO_DE_GRAVEDAD = {
  baja: 'informacion',
  media: 'advertencia',
  alta: 'peligro',
} as const;

/** Tono del estado: `sin_resolver` queda neutro; el texto lo dice en cualquier caso. */
export const TONO_DE_ESTADO = {
  sin_resolver: 'neutro',
  pendiente: 'advertencia',
  confirmado: 'peligro',
  descartado: 'primario',
} as const;
