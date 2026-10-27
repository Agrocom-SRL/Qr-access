import { crearContexto } from '../../../shared/lib/crearContexto';
import type { AnulacionRepositorio } from '../api/AnulacionRepositorio';

export const [ProveedorAnulacion, useAnulacionRepositorio] =
  crearContexto<AnulacionRepositorio>('AnulacionRepositorio');
