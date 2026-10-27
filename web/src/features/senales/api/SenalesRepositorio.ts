import type { Paginado } from '../../../shared/api/tipos';
import type {
  CuentaDeSenal,
  FiltrosDeSenales,
  ResumenDeSenales,
  SenalDeAbuso,
} from '../domain/senal';
import type { DetalleDeFlujo, FiltrosDeFlujo, ListadoDeFlujo } from '../domain/flujo';

/** Lo que necesitan las pestañas de señales y de flujo, y el detalle de flujo de una cuenta. */
export interface SenalesRepositorio {
  listarSenales: (filtros: FiltrosDeSenales) => Promise<Paginado<SenalDeAbuso>>;
  resumen: (dias: number) => Promise<ResumenDeSenales>;
  /** Las cuentas para el filtro por cuenta, sin pedir el permiso de cuentas. */
  opcionesDeCuenta: () => Promise<readonly CuentaDeSenal[]>;
  listarFlujo: (filtros: FiltrosDeFlujo) => Promise<ListadoDeFlujo>;
  flujoDeCuenta: (cuentaId: string, dias: number) => Promise<DetalleDeFlujo>;
}
