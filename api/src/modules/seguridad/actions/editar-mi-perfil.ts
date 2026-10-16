import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { RepositorioDeUsuarios } from '../repository.js';

/**
 * Cambia el nombre (etiqueta) del propio usuario. Es lo único que una persona edita de sí misma:
 * el PIN lo administra el administrador de la cuenta y los roles los asigna él (ADR 0018).
 * Siempre actúa sobre `principal.usuarioId`: no recibe un id, así nadie edita a otro por aquí.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  etiqueta: string,
): Promise<{ id: string; etiqueta: string }> {
  const usuarios = new RepositorioDeUsuarios(pool);
  if ((await usuarios.buscarActivoPorId(principal.usuarioId)) === null) {
    throw new ErrorDeDominio('autenticacion.requerida', 401);
  }
  await enTransaccion(pool, (tx) => usuarios.cambiarEtiqueta(tx, principal.usuarioId, etiqueta));
  return { id: principal.usuarioId, etiqueta };
}
