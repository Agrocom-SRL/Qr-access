import { crearContexto } from '../../../shared/lib/crearContexto';
import type { PlacasRepositorio } from '../api/PlacasRepositorio';

export const [ProveedorPlacas, usePlacasRepositorio] =
  crearContexto<PlacasRepositorio>('PlacasRepositorio');
