import type { Pool } from 'mysql2/promise';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { RepositorioDeSesiones, RepositorioDeUsuarios } from '../repository.js';
import { cerrarUnaSesion } from '../sesiones-abiertas.js';

/**
 * Cierra UNA sesión de un usuario de la rama del actor (ADR 0030 §4.1). Un usuario fuera de la rama, de otra
 * cuenta o el propio actor es 404 `usuario.no_encontrado`; una sesión que no es de ese usuario o ya no está viva,
 * 404 `sesion.no_encontrada`. No anula los QR del usuario: cerrar un solo aparato no es sospechar de su PIN.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  usuarioId: string,
  sesionId: string,
  ahora: Date = new Date(),
): Promise<void> {
  if (
    (await new RepositorioDeUsuarios(pool).buscarEnRama(principal.usuarioId, usuarioId)) === null
  ) {
    throw new ErrorDeDominio('usuario.no_encontrado', 404);
  }
  await cerrarUnaSesion(
    pool,
    new RepositorioDeSesiones(pool),
    usuarioId,
    sesionId,
    { motivo: 'superior', porUsuarioId: principal.usuarioId },
    ahora,
  );
}
