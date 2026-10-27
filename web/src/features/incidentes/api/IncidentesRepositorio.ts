import type { Paginado } from '../../../shared/api/tipos';
import type { FiltrosDeIncidentes, Incidente } from '../domain/incidente';

/** Lo que `application` necesita de los incidentes de una cuenta, en solo lectura (solo super admin). */
export interface IncidentesRepositorio {
  listar: (cuentaId: string, filtros: FiltrosDeIncidentes) => Promise<Paginado<Incidente>>;
}
