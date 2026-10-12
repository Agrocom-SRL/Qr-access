import type { Paginado } from '../../../shared/api/tipos';
import type { EventoBitacora, FiltrosDeBitacora, OpcionDeCuenta } from '../domain/evento';

export interface BitacoraRepositorio {
  listar: (filtros: FiltrosDeBitacora, porPagina: number) => Promise<Paginado<EventoBitacora>>;
  /** Las cuentas para el filtro "Cuenta". */
  cuentas: () => Promise<readonly OpcionDeCuenta[]>;
}
