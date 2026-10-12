/** API pública del módulo `pagos` del panel (registro de pagos y cobranza). */
export type { PagosRepositorio } from './api/PagosRepositorio';
export { crearPagosHttp } from './api/pagosHttp';
export { ProveedorPagos } from './application/contextos';
export { CLAVE_COBRANZA } from './application/usePagos';
export { CobranzaPage } from './ui/pages/CobranzaPage';
export { RegistrarPagoPage } from './ui/pages/RegistrarPagoPage';
