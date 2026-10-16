import { crearContexto } from '../../../shared/lib/crearContexto';
import type { CuentasRepositorio } from '../api/CuentasRepositorio';

export const [ProveedorCuentas, useCuentasRepositorio] =
  crearContexto<CuentasRepositorio>('CuentasRepositorio');
