/** API pública del módulo `incidentes` del panel: incidentes de uso de una cuenta, en solo lectura. */
export type { IncidentesRepositorio } from './api/IncidentesRepositorio';
export { crearIncidentesHttp } from './api/incidentesHttp';
export { ProveedorIncidentes } from './application/contextos';
export type { Incidente } from './domain/incidente';
export { PestanaIncidentes } from './ui/components/PestanaIncidentes';
