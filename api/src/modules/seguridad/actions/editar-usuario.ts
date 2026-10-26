import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { presentarUsuarios, type UsuarioListado } from '../presentacion.js';
import { RepositorioDeUsuarios } from '../repository.js';

/**
 * Cambia el nombre de un usuario de la rama del actor (HU-06). El rol no se edita: define el nivel
 * en el árbol (ADR 0028 §2). Uno de otra rama, de otra cuenta o el propio actor no existe: 404.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  usuarioId: string,
  etiqueta: string,
): Promise<UsuarioListado> {
  const usuarios = new RepositorioDeUsuarios(pool);
  if ((await usuarios.buscarEnRama(principal.usuarioId, usuarioId)) === null) {
    throw new ErrorDeDominio('usuario.no_encontrado', 404);
  }
  await enTransaccion(pool, (tx) => usuarios.cambiarEtiqueta(tx, usuarioId, etiqueta));

  const fila = await usuarios.buscarEnRama(principal.usuarioId, usuarioId);
  if (fila === null) throw new ErrorDeDominio('usuario.no_encontrado', 404);
  const [presentado] = await presentarUsuarios(pool, [fila]);
  if (presentado === undefined) throw new ErrorDeDominio('usuario.no_encontrado', 404);
  return presentado;
}
