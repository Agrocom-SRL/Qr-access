import { crearContexto } from '../../../shared/lib/crearContexto';
import type { LimitesRepositorio } from '../api/LimitesRepositorio';

export const [ProveedorLimites, useLimitesRepositorio] =
  crearContexto<LimitesRepositorio>('LimitesRepositorio');
