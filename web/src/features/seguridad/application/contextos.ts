import { crearContexto } from '../../../shared/lib/crearContexto';
import type { SeguridadRepositorio } from '../api/SeguridadRepositorio';

/** Inyección del repositorio de seguridad: `app/` provee el HTTP; los tests, un mock. */
export const [ProveedorSeguridad, useSeguridadRepositorio] =
  crearContexto<SeguridadRepositorio>('SeguridadRepositorio');
