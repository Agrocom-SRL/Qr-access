/** API pública del módulo `eventos` del panel: los accesos (lecturas de QR) de las cuentas. */
export type { EventosRepositorio } from './api/EventosRepositorio';
export { crearEventosHttp } from './api/eventosHttp';
export { ProveedorEventos } from './application/contextos';
export type { EventoDeAcceso } from './domain/evento';
export { PestanaAccesos } from './ui/components/PestanaAccesos';
export { EventosPage } from './ui/pages/EventosPage';
