import { z } from 'zod';

export const POR_PAGINA_MAXIMO = 100;
const POR_PAGINA_DEFECTO = 25;

/** Query de todo listado (ADR 0005): `pagina` desde 1 y `por_pagina` hasta 100. */
export const esquemaPaginacion = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  por_pagina: z.coerce.number().int().min(1).max(POR_PAGINA_MAXIMO).default(POR_PAGINA_DEFECTO),
});

export type Paginacion = z.infer<typeof esquemaPaginacion>;

/** Respuesta de un listado: `{ datos, meta: { pagina, por_pagina, total } }`. */
export function esquemaListado<T extends z.ZodType>(item: T) {
  return z.object({
    datos: z.array(item),
    meta: z.object({
      pagina: z.number().int(),
      por_pagina: z.number().int(),
      total: z.number().int(),
    }),
  });
}

export interface Listado<T> {
  readonly datos: T[];
  readonly meta: { readonly pagina: number; readonly por_pagina: number; readonly total: number };
}

export function armarListado<T>(datos: T[], paginacion: Paginacion, total: number): Listado<T> {
  return { datos, meta: { pagina: paginacion.pagina, por_pagina: paginacion.por_pagina, total } };
}

/** `LIMIT ? OFFSET ?` de una página. */
export function limiteDe(paginacion: Paginacion): { limite: number; desplazamiento: number } {
  return {
    limite: paginacion.por_pagina,
    desplazamiento: (paginacion.pagina - 1) * paginacion.por_pagina,
  };
}
