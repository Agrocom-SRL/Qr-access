import type { DetalleDeConsumo, FiltrosDeConsumo, ListadoDeConsumo } from '../domain/consumo';

/** Lo que necesita la vista de consumo de bolsa: la lista de cuentas y el detalle de una. */
export interface LimitesRepositorio {
  listarConsumo: (filtros: FiltrosDeConsumo) => Promise<ListadoDeConsumo>;
  consumoDeCuenta: (cuentaId: string) => Promise<DetalleDeConsumo>;
}
