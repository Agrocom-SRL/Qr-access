import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { diferenciaDeRoles } from '../domain/asignacion-de-roles.js';
import { presentarUsuarios, type UsuarioListado } from '../presentacion.js';
import { RepositorioDeRolesDeUsuario, RepositorioDeUsuarios } from '../repository.js';
import { exigirRolesAsignables } from './roles-asignables.js';

export interface CambiosDeUsuario {
  readonly etiqueta?: string;
  /** El conjunto completo de roles que debe quedar; los que no estén se quitan. */
  readonly rolIds?: readonly string[];
}

/** Cambia la etiqueta o los roles de un usuario de la cuenta (HU-06). Uno ajeno no existe: 404. */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  usuarioId: string,
  cambios: CambiosDeUsuario,
): Promise<UsuarioListado> {
  const usuarios = new RepositorioDeUsuarios(pool);
  if ((await usuarios.buscarPorId(usuarioId)) === null) {
    throw new ErrorDeDominio('usuario.no_encontrado', 404);
  }
  const rolIds = cambios.rolIds === undefined ? null : [...new Set(cambios.rolIds)];
  if (rolIds !== null) await exigirRolesAsignables(pool, principal, rolIds);

  const asignaciones = new RepositorioDeRolesDeUsuario(pool);
  await enTransaccion(pool, async (tx) => {
    if (cambios.etiqueta !== undefined) {
      await usuarios.cambiarEtiqueta(tx, usuarioId, cambios.etiqueta);
    }
    if (rolIds !== null) {
      const actuales = (await asignaciones.asignacionesDe(usuarioId)).map((fila) => ({
        id: fila.id,
        rolId: fila.rol_id,
      }));
      const diferencia = diferenciaDeRoles(actuales, rolIds);
      for (const asignacionId of diferencia.quitar) await asignaciones.quitar(tx, asignacionId);
      for (const rolId of diferencia.agregar) await asignaciones.asignar(tx, usuarioId, rolId);
    }
  });

  const fila = await usuarios.buscarPorId(usuarioId);
  if (fila === null) throw new ErrorDeDominio('usuario.no_encontrado', 404);
  const [presentado] = await presentarUsuarios(pool, [fila]);
  if (presentado === undefined) throw new ErrorDeDominio('usuario.no_encontrado', 404);
  return presentado;
}
