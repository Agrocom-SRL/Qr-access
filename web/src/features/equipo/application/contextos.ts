import { crearContexto } from '../../../shared/lib/crearContexto';
import type { EquipoRepositorio } from '../api/EquipoRepositorio';

export const [ProveedorEquipo, useEquipoRepositorio] =
  crearContexto<EquipoRepositorio>('EquipoRepositorio');
