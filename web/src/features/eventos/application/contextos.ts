import { crearContexto } from '../../../shared/lib/crearContexto';
import type { EventosRepositorio } from '../api/EventosRepositorio';

export const [ProveedorEventos, useEventosRepositorio] =
  crearContexto<EventosRepositorio>('EventosRepositorio');
