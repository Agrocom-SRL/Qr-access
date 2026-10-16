import type { Paginado } from '../../../shared/api/tipos';
import type { EventoDeAcceso, FiltrosDeEventos, OpcionDeCuenta } from '../domain/evento';

/** Lo que `application` necesita de `/plataforma/eventos-acceso`. */
export interface EventosRepositorio {
  listar: (filtros: FiltrosDeEventos, porPagina: number) => Promise<Paginado<EventoDeAcceso>>;
  /** Las cuentas para el filtro "Cuenta". */
  cuentas: () => Promise<readonly OpcionDeCuenta[]>;
}
