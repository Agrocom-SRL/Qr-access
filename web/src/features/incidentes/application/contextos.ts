import { crearContexto } from '../../../shared/lib/crearContexto';
import type { IncidentesRepositorio } from '../api/IncidentesRepositorio';

export const [ProveedorIncidentes, useIncidentesRepositorio] =
  crearContexto<IncidentesRepositorio>('IncidentesRepositorio');
