import type { Pool } from 'mysql2/promise';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { presentarUsuarios, type UsuarioListado } from '../presentacion.js';
import { RepositorioDeUsuarios } from '../repository.js';

/** Lo que dice el estado de un usuario: el propio, el efectivo (D-25) y quién, cuándo y por qué. */
export type EstadoDeUsuario = Pick<
  UsuarioListado,
  | 'id'
  | 'estado'
  | 'estado_efectivo'
  | 'estado_origen'
  | 'estado_motivo'
  | 'estado_desde'
  | 'estado_impuesto_por'
>;

/** El estado de un usuario de la rama del actor; uno de otra rama, de otra cuenta o el propio actor no existe: 404. */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  usuarioId: string,
): Promise<EstadoDeUsuario> {
  const fila = await new RepositorioDeUsuarios(pool).buscarEnRama(principal.usuarioId, usuarioId);
  if (fila === null) throw new ErrorDeDominio('usuario.no_encontrado', 404);
  const [usuario] = await presentarUsuarios(pool, [fila]);
  if (usuario === undefined) throw new ErrorDeDominio('usuario.no_encontrado', 404);
  return {
    id: usuario.id,
    estado: usuario.estado,
    estado_efectivo: usuario.estado_efectivo,
    estado_origen: usuario.estado_origen,
    estado_motivo: usuario.estado_motivo,
    estado_desde: usuario.estado_desde,
    estado_impuesto_por: usuario.estado_impuesto_por,
  };
}
