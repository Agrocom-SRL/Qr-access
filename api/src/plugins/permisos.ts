import type { FastifyRequest } from 'fastify';
import { ErrorDeDominio } from '../platform/errores/error-de-dominio.js';
import type { PrincipalDispositivo, PrincipalUsuario } from '../platform/seguridad/principal.js';

/** El usuario autenticado de la petición; una ruta `usuario` siempre lo tiene. */
export function usuarioDe(request: FastifyRequest): PrincipalUsuario {
  if (request.principal?.tipo !== 'usuario')
    throw new ErrorDeDominio('autenticacion.requerida', 401);
  return request.principal;
}

/** El dispositivo autenticado de la petición; una ruta `dispositivo` siempre lo tiene. */
export function dispositivoDe(request: FastifyRequest): PrincipalDispositivo {
  if (request.principal?.tipo !== 'dispositivo') {
    throw new ErrorDeDominio('dispositivo.credencial_invalida', 401);
  }
  return request.principal;
}

/** ¿El rol activo del usuario tiene este permiso? (no consulta la base: ya la revalidó el plugin) */
export function tienePermiso(usuario: PrincipalUsuario, codigo: string): boolean {
  return usuario.permisos.has(codigo);
}

/**
 * `preHandler` que exige un permiso del rol activo (ADR 0004 §9). Sin rol activo no hay
 * permisos: 403. El aislamiento por registro lo hace el repositorio, no esta capa.
 */
export function permiso(codigo: string) {
  return (request: FastifyRequest): Promise<void> => {
    if (!tienePermiso(usuarioDe(request), codigo)) {
      return Promise.reject(new ErrorDeDominio('permiso.denegado', 403, { permiso: codigo }));
    }
    return Promise.resolve();
  };
}
