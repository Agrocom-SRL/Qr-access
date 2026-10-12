import { crearContexto } from '../../../shared/lib/crearContexto';
import type { SuscripcionesRepositorio } from '../api/SuscripcionesRepositorio';

export const [ProveedorSuscripciones, useSuscripcionesRepositorio] =
  crearContexto<SuscripcionesRepositorio>('SuscripcionesRepositorio');
