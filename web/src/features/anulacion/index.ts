/** API pública del módulo `anulacion` del panel: anulación masiva de los QR de una cuenta (solo super admin). */
export type { AnulacionRepositorio } from './api/AnulacionRepositorio';
export { crearAnulacionHttp } from './api/anulacionHttp';
export { ProveedorAnulacion } from './application/contextos';
export { PERMISO_ANULAR_QR_DE_CUENTA } from './domain/anulacion';
export { PanelAnulacionMasiva } from './ui/components/PanelAnulacionMasiva';
