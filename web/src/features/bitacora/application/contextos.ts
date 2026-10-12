import { crearContexto } from '../../../shared/lib/crearContexto';
import type { BitacoraRepositorio } from '../api/BitacoraRepositorio';

export const [ProveedorBitacora, useBitacoraRepositorio] =
  crearContexto<BitacoraRepositorio>('BitacoraRepositorio');
