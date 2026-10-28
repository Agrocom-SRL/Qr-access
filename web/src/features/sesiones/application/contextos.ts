import { crearContexto } from '../../../shared/lib/crearContexto';
import type { SesionesRepositorio } from '../api/SesionesRepositorio';

export const [ProveedorSesiones, useSesionesRepositorio] =
  crearContexto<SesionesRepositorio>('SesionesRepositorio');
