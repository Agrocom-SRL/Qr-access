import { RUTAS, rutaDeCuenta } from '../../shared/lib/rutas';

/** Rutas del módulo `cuentas` (las compone `app/`). */
export const RUTAS_DE_CUENTAS = {
  lista: RUTAS.cuentas,
  nueva: RUTAS.cuentaNueva,
  detalle: rutaDeCuenta,
} as const;
