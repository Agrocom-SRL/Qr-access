/** API pública del módulo `sesiones` del panel: dispositivos conectados de un usuario de una cuenta. */
export type { SesionesRepositorio } from './api/SesionesRepositorio';
export { crearSesionesHttp } from './api/sesionesHttp';
export { ProveedorSesiones } from './application/contextos';
export type { SesionDeUsuario, UsuarioConSesiones } from './domain/sesion';
export { PERMISO_CERRAR_SESIONES, PERMISO_VER_SESIONES } from './domain/sesion';
export { DialogoSesionesDeUsuario } from './ui/components/DialogoSesionesDeUsuario';
