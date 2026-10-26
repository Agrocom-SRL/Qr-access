import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { hashear } from '../../../platform/seguridad/hash.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { contrasenaValida, normalizarUsername } from '../domain/super-admin.js';
import {
  RepositorioDeRolesDePlataforma,
  RepositorioDeRolesDeSuperAdmin,
  RepositorioDeSuperAdmins,
} from '../repository.js';
import type { ServiciosDeSeguridad } from '../servicios.js';
import type { MiembroDelEquipo } from './listar-equipo.js';

export interface DatosDeNuevoMiembro {
  readonly nombre: string;
  readonly usuario: string;
  /** La fija quien lo agrega; el nuevo la cambia en su primer ingreso (A11b). */
  readonly contrasenaTemporal: string;
}

/**
 * Agrega a alguien al equipo AGROCOM con el rol Super admin y una contraseña temporal. La
 * contraseña no se guarda en claro ni se devuelve (invariante 6); queda marcada como temporal.
 */
export async function ejecutar(
  servicios: Pick<ServiciosDeSeguridad, 'pool'>,
  _principal: PrincipalPlataforma,
  datos: DatosDeNuevoMiembro,
): Promise<MiembroDelEquipo> {
  const { pool } = servicios;
  const username = normalizarUsername(datos.usuario);
  if (username === null) throw new ErrorDeDominio('usuario.formato_invalido', 422);
  if (!contrasenaValida(datos.contrasenaTemporal)) {
    throw new ErrorDeDominio('contrasena.invalida', 422);
  }

  const admins = new RepositorioDeSuperAdmins(pool);
  if (await admins.existeUsername(username)) throw new ErrorDeDominio('usuario.existente', 409);
  const rol = await new RepositorioDeRolesDePlataforma(pool).buscarSuperAdmin();
  if (rol === null) throw new ErrorDeDominio('rol.no_encontrado', 500);

  const contrasenaHash = await hashear(datos.contrasenaTemporal);
  const id = await enTransaccion(pool, async (tx) => {
    const nuevoId = await admins.crear(tx, { nombre: datos.nombre, username, contrasenaHash });
    await new RepositorioDeRolesDeSuperAdmin(pool).asignar(tx, nuevoId, rol.id);
    return nuevoId;
  });

  const fila = await admins.buscarPorId(id);
  if (fila === null) throw new ErrorDeDominio('usuario.no_encontrado', 404);
  return {
    id: fila.id,
    nombre: fila.etiqueta,
    usuario: fila.username,
    activo: true,
    estado: 'activo',
    es_actual: false,
    ultimo_ingreso_at: null,
    created_at: fila.created_at.toISOString(),
  };
}
