import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { hashear, verificarHash } from '../../../platform/seguridad/hash.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { contrasenaValida } from '../domain/super-admin.js';
import { RepositorioDeSuperAdmins } from '../repository.js';
import type { ServiciosDeSeguridad } from '../servicios.js';

export interface DatosDeCambioDeContrasena {
  readonly actual: string;
  readonly nueva: string;
}

/**
 * Cambia la contraseña del propio super admin (A12). Pide la actual, exige una nueva distinta
 * y quita la marca de contraseña temporal. No toca sus sesiones: sigue dentro.
 */
export async function ejecutar(
  servicios: Pick<ServiciosDeSeguridad, 'pool'>,
  principal: PrincipalPlataforma,
  datos: DatosDeCambioDeContrasena,
): Promise<void> {
  const admins = new RepositorioDeSuperAdmins(servicios.pool);
  const admin = await admins.buscarActivoPorId(principal.usuarioId);
  if (admin === null) throw new ErrorDeDominio('autenticacion.requerida', 401);

  if (!(await verificarHash(admin.contrasena_hash, datos.actual))) {
    throw new ErrorDeDominio('contrasena.actual_incorrecta', 422);
  }
  if (!contrasenaValida(datos.nueva)) throw new ErrorDeDominio('contrasena.invalida', 422);
  if (datos.nueva === datos.actual) throw new ErrorDeDominio('contrasena.sin_cambio', 422);

  const hash = await hashear(datos.nueva);
  await enTransaccion(servicios.pool, (tx) => admins.cambiarContrasena(tx, admin.id, hash));
}
