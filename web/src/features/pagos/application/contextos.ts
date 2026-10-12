import { crearContexto } from '../../../shared/lib/crearContexto';
import type { PagosRepositorio } from '../api/PagosRepositorio';

export const [ProveedorPagos, usePagosRepositorio] =
  crearContexto<PagosRepositorio>('PagosRepositorio');
