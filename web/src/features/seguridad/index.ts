/** API pública del módulo `seguridad` del panel (los demás módulos solo importan de acá). */
export type { SeguridadRepositorio } from './api/SeguridadRepositorio';
export { crearSeguridadHttp } from './api/seguridadHttp';
export { ProveedorSeguridad } from './application/contextos';
export { SesionProvider, useSesion } from './application/SesionProvider';
export { tienePermiso } from './domain/sesion';
export type { PerfilAdmin, SesionIniciada, UsuarioSesion } from './domain/sesion';
export { IngresoPage } from './ui/pages/IngresoPage';
export { PerfilPage } from './ui/pages/PerfilPage';
