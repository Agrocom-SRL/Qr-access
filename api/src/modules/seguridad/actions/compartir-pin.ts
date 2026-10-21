import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { RepositorioDeUsuarios } from '../repository.js';

/**
 * Registra que el PIN de un usuario de la rama del actor se compartió por la hoja de compartir del
 * sistema (WhatsApp, correo…): un canal de terceros por el que el PIN viaja en claro (ADR 0028 §7).
 * No cambia el PIN ni obliga a cambiarlo: solo deja rastro en la bitácora de quién lo compartió y
 * cuándo, sin el PIN. Un usuario de otra rama, de otra cuenta o el propio actor no existe: 404.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  usuarioId: string,
  ahora: Date = new Date(),
): Promise<void> {
  const usuarios = new RepositorioDeUsuarios(pool);
  if ((await usuarios.buscarEnRama(principal.usuarioId, usuarioId)) === null) {
    throw new ErrorDeDominio('usuario.no_encontrado', 404);
  }
  await enTransaccion(pool, (tx) => usuarios.marcarPinCompartido(tx, usuarioId, ahora));
}
