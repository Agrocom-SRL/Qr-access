import type { Paginado } from '../../../shared/api/tipos';
import type { FiltroDeNotificaciones, Notificacion } from '../domain/notificacion';

/** Lo que `application` necesita de `/plataforma/notificaciones` (la bandeja de AGROCOM). */
export interface NotificacionesRepositorio {
  listar: (filtro: FiltroDeNotificaciones, pagina: number) => Promise<Paginado<Notificacion>>;
  /** Cuántas sin leer, para la campana. */
  noLeidas: () => Promise<number>;
  leer: (id: string) => Promise<void>;
  descartar: (id: string) => Promise<void>;
  /** Marca todas las sin leer; devuelve cuántas eran. */
  leerTodas: () => Promise<number>;
}
