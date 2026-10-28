/** API pública del módulo `senales` del panel: señales de abuso y flujo de aperturas (ADR 0030 §4 y §5). */
export type { SenalesRepositorio } from './api/SenalesRepositorio';
export type { DetalleDeFlujo, FiltrosDeFlujo, FlujoDeCuenta, ListadoDeFlujo } from './domain/flujo';
export type {
  CuentaDeSenal,
  FiltrosDeSenales,
  ResumenDeSenales,
  SenalDeAbuso,
} from './domain/senal';
export { crearSenalesHttp } from './api/senalesHttp';
export { ProveedorSenales } from './application/contextos';
export { CLAVE_SENALES } from './application/useSenales';
export { DetalleFlujoPage } from './ui/pages/DetalleFlujoPage';
export { PestanaFlujo } from './ui/components/PestanaFlujo';
export { PestanaSenales } from './ui/components/PestanaSenales';
