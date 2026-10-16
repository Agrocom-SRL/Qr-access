/** API pública del módulo `bitacora` del panel. */
export type { BitacoraRepositorio } from './api/BitacoraRepositorio';
export { crearBitacoraHttp } from './api/bitacoraHttp';
export { ProveedorBitacora } from './application/contextos';
export { CLAVE_BITACORA } from './application/useBitacora';
export type { EventoBitacora } from './domain/evento';
export { describirEvento } from './ui/describirEvento';
export { PestanaBitacora } from './ui/components/PestanaBitacora';
export { BitacoraPage } from './ui/pages/BitacoraPage';
