/** Listado paginado en forma de dominio; la API responde `{ datos, meta }` (ADR 0005). */
export interface Paginado<T> {
  elementos: readonly T[];
  pagina: number;
  porPagina: number;
  total: number;
}

/** Cuerpo crudo de un listado de la API. */
export interface ListadoDto<D> {
  datos: D[];
  meta: { pagina: number; por_pagina: number; total: number };
}

export function paginadoDesde<D, T>(dto: ListadoDto<D>, mapear: (d: D) => T): Paginado<T> {
  return {
    elementos: dto.datos.map(mapear),
    pagina: dto.meta.pagina,
    porPagina: dto.meta.por_pagina,
    total: dto.meta.total,
  };
}
