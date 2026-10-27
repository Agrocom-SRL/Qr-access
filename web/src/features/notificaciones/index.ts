/** API pública del módulo `notificaciones` del panel: la bandeja de avisos de AGROCOM. */
export type { NotificacionesRepositorio } from './api/NotificacionesRepositorio';
export { crearNotificacionesHttp } from './api/notificacionesHttp';
export { ProveedorNotificaciones } from './application/contextos';
export type { Notificacion } from './domain/notificacion';
export { CampanaNotificaciones } from './ui/components/CampanaNotificaciones';
