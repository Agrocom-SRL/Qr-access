import { crearContexto } from '../../../shared/lib/crearContexto';
import type { EstadisticasRepositorio } from '../api/EstadisticasRepositorio';

export const [ProveedorEstadisticas, useEstadisticasRepositorio] =
  crearContexto<EstadisticasRepositorio>('EstadisticasRepositorio');
