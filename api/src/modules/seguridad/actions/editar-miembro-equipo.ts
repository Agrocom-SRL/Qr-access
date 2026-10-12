import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { RepositorioDeSuperAdmins } from '../repository.js';
import type { ServiciosDeSeguridad } from '../servicios.js';
import { ejecutar as desactivar } from './desactivar-miembro-equipo.js';

export interface CambiosDeMiembro {
  readonly nombre?: string | undefined;
  readonly activo?: boolean | undefined;
}

/**
 * Cambia el nombre de un miembro del equipo AGROCOM y/o lo reactiva (A11). Desactivar reutiliza su
 * acción, con las reglas de siempre (no a sí mismo, siempre queda un activo); reactivar no corta ni
 * crea sesiones: la persona vuelve a ingresar con su contraseña.
 */
export async function ejecutar(
  servicios: Pick<ServiciosDeSeguridad, 'pool'>,
  principal: PrincipalPlataforma,
  objetivoId: string,
  cambios: CambiosDeMiembro,
): Promise<void> {
  const admins = new RepositorioDeSuperAdmins(servicios.pool);
  const objetivo = await admins.buscarPorId(objetivoId);
  if (objetivo === null) throw new ErrorDeDominio('usuario.no_encontrado', 404);

  if (cambios.nombre !== undefined && cambios.nombre !== objetivo.etiqueta) {
    await enTransaccion(servicios.pool, (tx) =>
      admins.renombrar(tx, objetivoId, cambios.nombre ?? ''),
    );
  }
  if (cambios.activo === true && objetivo.activo !== 1) {
    await enTransaccion(servicios.pool, (tx) => admins.reactivar(tx, objetivoId));
  }
  if (cambios.activo === false) await desactivar(servicios, principal, objetivoId);
}
