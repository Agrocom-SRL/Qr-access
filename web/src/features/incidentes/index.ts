/** API pública del módulo `incidentes` del panel: incidentes de uso de una cuenta y su resolución (solo super admin). */
export type { IncidentesRepositorio, PedidoDeResolucion } from './api/IncidentesRepositorio';
export { crearIncidentesHttp } from './api/incidentesHttp';
export { ProveedorIncidentes } from './application/contextos';
export type { Incidente, RespuestaDeResolucion } from './domain/incidente';
export { PERMISO_RESOLVER_INCIDENTE_DE_CUENTA } from './domain/incidente';
export { PestanaIncidentes } from './ui/components/PestanaIncidentes';
