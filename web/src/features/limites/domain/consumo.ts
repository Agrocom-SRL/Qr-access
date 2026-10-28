/**
 * Consumo de la bolsa mensual de QR por cuenta (ADR 0030 §2, ola W12). Espejo de
 * `/plataforma/consumo-de-bolsa` y `/plataforma/cuentas/{id}/consumo-de-bolsa`: el panel solo
 * muestra. Ninguna cifra de acá limita ni bloquea a nadie; el único límite comercial es el cupo de
 * usuarios del plan (invariante 6), así que aquí no se calcula un tope por QR.
 */

export const ESTADOS_DE_BOLSA = ['normal', 'aviso', 'superada', 'sin_tope'] as const;
export type EstadoDeBolsa = (typeof ESTADOS_DE_BOLSA)[number];

/** `todos` no es un estado: es el filtro que no pide ninguno en particular. */
export type FiltroDeBolsa = EstadoDeBolsa | 'todos';

export const ORDENES_DE_CONSUMO = ['porcentaje', 'usado', 'tope', 'nombre'] as const;
export type OrdenDeConsumo = (typeof ORDENES_DE_CONSUMO)[number];

export type Sentido = 'desc' | 'asc';

/** Cuántas cuentas por página en el ranking; la API acepta hasta 100. */
export const POR_PAGINA_DE_CONSUMO = 25;

/** Largo máximo de la búsqueda, el mismo que valida la API (ADR 0005). */
export const LARGO_MAXIMO_DE_BUSQUEDA = 60;

export interface CuentaDeConsumo {
  id: string;
  codigo: string;
  nombre: string;
}

/**
 * El consumo de una cuenta en el mes en curso. `porcentaje` puede pasar de 100 y es `null` sin
 * bolsa; `origenDelTope` dice de dónde sale el tope que rige.
 */
export interface ConsumoDeCuenta {
  cuenta: CuentaDeConsumo;
  plan: string | null;
  usado: number;
  tope: number | null;
  porcentaje: number | null;
  estado: EstadoDeBolsa;
  origenDelTope: 'excepcion' | 'plan' | 'general' | null;
  avisoEn: Date | null;
  superadaEn: Date | null;
}

/** Detalle de una cuenta: el consumo más la serie de QR generados por día del mes. */
export interface DetalleDeConsumo extends ConsumoDeCuenta {
  /** Mes local en curso, `aaaa-mm`. */
  mes: string;
  desde: Date;
  avisoPorcentaje: number;
  serie: readonly SerieDeConsumo[];
}

export interface SerieDeConsumo {
  /** `aaaa-mm-dd` del calendario de la plataforma. */
  dia: string;
  generados: number;
}

export type ConteoPorEstado = Readonly<Record<EstadoDeBolsa, number>>;

export interface ListadoDeConsumo {
  elementos: readonly ConsumoDeCuenta[];
  pagina: number;
  porPagina: number;
  total: number;
  mes: string;
  avisoPorcentaje: number;
  /** Cuántas cuentas hay en cada estado, sin aplicar el filtro de estado ni el de búsqueda. */
  porEstado: ConteoPorEstado;
}

export interface FiltrosDeConsumo {
  estado: FiltroDeBolsa;
  buscar: string;
  orden: OrdenDeConsumo;
  sentido: Sentido;
  pagina: number;
}

export const FILTROS_INICIALES_DE_CONSUMO: FiltrosDeConsumo = {
  estado: 'todos',
  buscar: '',
  orden: 'porcentaje',
  sentido: 'desc',
  pagina: 1,
};

/**
 * Ancho de la barra en porcentaje (0–100). Una cuenta que pasó la bolsa deja la barra llena y el
 * texto dice el número real: la barra no finge un máximo que no existe.
 */
export function anchoDeBarra(porcentaje: number | null): number {
  if (porcentaje === null) return 0;
  return Math.min(100, Math.max(0, porcentaje));
}
