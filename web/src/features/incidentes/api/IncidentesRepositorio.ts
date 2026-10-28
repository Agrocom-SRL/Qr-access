import type { Paginado } from '../../../shared/api/tipos';
import type {
  FiltrosDeIncidentes,
  Incidente,
  RespuestaDeResolucion,
  ResultadoDeResolucion,
} from '../domain/incidente';

/** Lo que el panel manda para resolver un incidente: el resultado y, si hace falta, el motivo. */
export interface PedidoDeResolucion {
  resultado: ResultadoDeResolucion;
  motivo?: string;
}

/** Lo que `application` necesita de los incidentes de una cuenta (solo super admin). */
export interface IncidentesRepositorio {
  listar: (cuentaId: string, filtros: FiltrosDeIncidentes) => Promise<Paginado<Incidente>>;
  resolver: (
    cuentaId: string,
    incidenteId: string,
    pedido: PedidoDeResolucion,
  ) => Promise<RespuestaDeResolucion>;
}
