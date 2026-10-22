/** API pública del módulo `cobro` del panel: las cuentas donde AGROCOM recibe sus pagos (ADR 0029). */
export type { CobroRepositorio } from './api/CobroRepositorio';
export { crearCobroHttp } from './api/cobroHttp';
export { ProveedorCobro } from './application/contextos';
export { CLAVE_COBRO, useCuentasDeCobro } from './application/useCobro';
export type { CuentaDeCobro, MetodoDeCobro } from './domain/cuentaDeCobro';
export { CuentasParaPagar } from './ui/components/CuentasParaPagar';
export { CuentasDeCobroPage } from './ui/pages/CuentasDeCobroPage';
