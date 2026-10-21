import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { RepositorioDeSesiones, RepositorioDeUsuarios } from '../repository.js';

/**
 * Da de baja un usuario de la rama del actor (HU-06): su PIN deja de entrar y sus sesiones se cortan
 * en el acto (ADR 0018 §2). Nadie se da de baja a sí mismo: se quedaría sin administrador. Uno que
 * todavía tiene usuarios debajo no se da de baja: dejaría huérfanos (la baja en cascada con
 * confirmación llega con la gestión de usuarios por nivel, ADR 0028 §7).
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  usuarioId: string,
  ahora: Date = new Date(),
): Promise<void> {
  if (usuarioId === principal.usuarioId) throw new ErrorDeDominio('usuario.propio', 422);
  const usuarios = new RepositorioDeUsuarios(pool);
  if ((await usuarios.buscarEnRama(principal.usuarioId, usuarioId)) === null) {
    throw new ErrorDeDominio('usuario.no_encontrado', 404);
  }
  if ((await usuarios.contarDirectos(usuarioId)) > 0) {
    throw new ErrorDeDominio('usuario.con_dependientes', 409);
  }
  await enTransaccion(pool, async (tx) => {
    await usuarios.darDeBaja(tx, usuarioId);
    await new RepositorioDeSesiones(pool).revocarTodasDe(tx, usuarioId, ahora);
  });
}
