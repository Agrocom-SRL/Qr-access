import { crearContexto } from '../../../shared/lib/crearContexto';
import type { PlanesRepositorio } from '../api/PlanesRepositorio';

export const [ProveedorPlanes, usePlanesRepositorio] =
  crearContexto<PlanesRepositorio>('PlanesRepositorio');
