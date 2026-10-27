import type { Pool } from 'mysql2/promise';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { Listado } from '../../../platform/http/paginacion.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import type { SesionAbierta } from '../domain/sesion.js';
import { RepositorioDeSesiones, RepositorioDeUsuarios } from '../repository.js';
import { listarSesiones } from '../sesiones-abiertas.js';

/**
 * Los dispositivos conectados de un usuario de la rama del actor (ADR 0030 §4.1, árbol del ADR 0028 §4). Un usuario
 * de otra rama, de otra cuenta o el propio actor no existe: 404 (las propias van por `listar-mis-sesiones`).
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  usuarioId: string,
  ahora: Date = new Date(),
): Promise<Listado<SesionAbierta>> {
  if (
    (await new RepositorioDeUsuarios(pool).buscarEnRama(principal.usuarioId, usuarioId)) === null
  ) {
    throw new ErrorDeDominio('usuario.no_encontrado', 404);
  }
  return listarSesiones(new RepositorioDeSesiones(pool), usuarioId, null, ahora);
}
