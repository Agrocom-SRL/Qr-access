import { crearContexto } from '../../../shared/lib/crearContexto';
import type { SenalesRepositorio } from '../api/SenalesRepositorio';

export const [ProveedorSenales, useSenalesRepositorio] =
  crearContexto<SenalesRepositorio>('SenalesRepositorio');
