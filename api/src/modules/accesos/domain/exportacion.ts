/**
 * Reglas de la exportación de datos de la cuenta (ADR 0033 §3, ola W11). Puro: no toca la base.
 */

export const RECURSOS_EXPORTABLES = ['usuarios', 'puertas', 'lecturas'] as const;
export type RecursoExportable = (typeof RECURSOS_EXPORTABLES)[number];

/**
 * Tope de filas que se entregan de UN recurso en total, sumando todas las páginas (supuesto de la ola W11: el ADR
 * pide «tope de filas» y no da el número). Quien necesite más acota con filtros (`desde`/`hasta` en las lecturas).
 */
export const TOPE_DE_FILAS_EXPORTABLES = 10_000;

/** Filas por página: lo que se pide por omisión y el máximo (más que un listado: es para descargar). */
export const FILAS_POR_PAGINA_POR_OMISION = 500;
export const FILAS_POR_PAGINA_MAXIMAS = 1_000;

export interface TramoDeExportacion {
  /** Cuántas filas leer en esta página (puede ser menos que lo pedido si el tope corta antes). */
  readonly limite: number;
  readonly desplazamiento: number;
}

/**
 * Qué tramo toca leer para esa página, o `null` si ya cae fuera del tope (la página pedida empieza más allá de la
 * última fila exportable). El tope se aplica al TOTAL: la última página puede salir más corta.
 */
export function tramoDe(pagina: number, porPagina: number): TramoDeExportacion | null {
  const desplazamiento = (pagina - 1) * porPagina;
  if (desplazamiento >= TOPE_DE_FILAS_EXPORTABLES) return null;
  return {
    limite: Math.min(porPagina, TOPE_DE_FILAS_EXPORTABLES - desplazamiento),
    desplazamiento,
  };
}

export interface ResumenDeExportacion {
  /** Filas exportables en total: lo que hay, hasta el tope. */
  readonly total: number;
  /** `true` si hay más filas que el tope y el resto NO se exporta. */
  readonly truncado: boolean;
  /** ¿Hay una página siguiente? */
  readonly hayMas: boolean;
}

export function resumirExportacion(
  totalReal: number,
  tramo: TramoDeExportacion,
  filasEntregadas: number,
): ResumenDeExportacion {
  const total = Math.min(totalReal, TOPE_DE_FILAS_EXPORTABLES);
  return {
    total,
    truncado: totalReal > TOPE_DE_FILAS_EXPORTABLES,
    hayMas: tramo.desplazamiento + filasEntregadas < total,
  };
}
