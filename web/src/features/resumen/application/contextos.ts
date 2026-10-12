import { crearContexto } from '../../../shared/lib/crearContexto';
import type { ResumenRepositorio } from '../api/ResumenRepositorio';

export const [ProveedorResumen, useResumenRepositorio] =
  crearContexto<ResumenRepositorio>('ResumenRepositorio');
