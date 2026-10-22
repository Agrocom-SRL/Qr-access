import { crearContexto } from '../../../shared/lib/crearContexto';
import type { CobroRepositorio } from '../api/CobroRepositorio';

export const [ProveedorCobro, useCobroRepositorio] =
  crearContexto<CobroRepositorio>('CobroRepositorio');
