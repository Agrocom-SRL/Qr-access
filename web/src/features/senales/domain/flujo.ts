/**
 * Flujo de aperturas por cuenta (ADR 0030 §4, ola W12). Un día es atípico cuando cruza a la vez el
 * mínimo de aperturas y el de aperturas por usuario activo. La base habitual y las veces que
 * supera la base sirven para que una persona juzgue un pico de un día frente a uno sostenido: no
 * deciden nada.
 */
import type { CuentaDeSenal } from './senal';

export const ORDENES_DE_FLUJO = ['por_usuario', 'aperturas', 'dias_atipicos', 'nombre'] as const;
export type OrdenDeFlujo = (typeof ORDENES_DE_FLUJO)[number];

export type Sentido = 'desc' | 'asc';

/** Periodos de la lista (hasta 30 días, como la API) y del detalle (hasta 90). */
export const PERIODOS_DE_LA_LISTA = [7, 14, 30] as const;
export const PERIODOS_DEL_DETALLE = [7, 30, 90] as const;

export const POR_PAGINA_DE_FLUJO = 15;

/** Largo máximo de la búsqueda, el mismo que valida la API (ADR 0005). */
export const LARGO_MAXIMO_DE_BUSQUEDA_FLUJO = 60;

export interface UmbralesDeFlujo {
  aperturasMinimo: number;
  aperturasPorUsuario: number;
}

/** El flujo de una cuenta: la foto de hoy y lo que pasó en el periodo. */
export interface FlujoDeCuenta {
  cuenta: CuentaDeSenal;
  usuariosActivos: number;
  umbrales: UmbralesDeFlujo;
  aperturasHoy: number;
  porUsuarioHoy: number;
  atipicaHoy: boolean;
  aperturasPeriodo: number;
  diasAtipicos: number;
  /** `aaaa-mm-dd` del último día atípico, o `null` si el periodo no tuvo ninguno. */
  ultimoDiaAtipico: string | null;
  base: number | null;
}

export interface ListadoDeFlujo {
  elementos: readonly FlujoDeCuenta[];
  pagina: number;
  porPagina: number;
  total: number;
  dias: number;
  /** Día de hoy en el calendario de la plataforma (`aaaa-mm-dd`). */
  hoy: string;
}

export interface FiltrosDeFlujo {
  dias: number;
  soloAtipicas: boolean;
  buscar: string;
  orden: OrdenDeFlujo;
  sentido: Sentido;
  pagina: number;
}

export const FILTROS_INICIALES_DE_FLUJO: FiltrosDeFlujo = {
  dias: 7,
  soloAtipicas: false,
  buscar: '',
  orden: 'por_usuario',
  sentido: 'desc',
  pagina: 1,
};

export interface DiaDeFlujo {
  /** `aaaa-mm-dd`. */
  dia: string;
  aperturas: number;
  rechazos: number;
  generados: number;
  porUsuario: number;
  atipico: boolean;
  base: number | null;
  vecesLaBase: number | null;
}

export interface DetalleDeFlujo {
  cuenta: CuentaDeSenal;
  usuariosActivos: number;
  umbrales: UmbralesDeFlujo;
  zonaHoraria: string;
  serie: readonly DiaDeFlujo[];
}
