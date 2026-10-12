/** Rutas del módulo `cuentas` (las compone `app/`). */
export const RUTAS_DE_CUENTAS = {
  lista: '/cuentas',
  nueva: '/cuentas/nueva',
  detalle: (id: string) => `/cuentas/${id}`,
} as const;
