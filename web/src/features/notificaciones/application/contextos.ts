import { crearContexto } from '../../../shared/lib/crearContexto';
import type { NotificacionesRepositorio } from '../api/NotificacionesRepositorio';

export const [ProveedorNotificaciones, useNotificacionesRepositorio] =
  crearContexto<NotificacionesRepositorio>('NotificacionesRepositorio');
