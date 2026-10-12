import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { motivoParaNoDesactivar } from '../domain/super-admin.js';
import { RepositorioDeSesionesDeSuperAdmins, RepositorioDeSuperAdmins } from '../repository.js';
import type { ServiciosDeSeguridad } from '../servicios.js';

/**
 * Desactiva a un super admin y corta sus sesiones (A11). No se puede desactivar a sí mismo
 * ni al último activo; las filas activas se bloquean durante la transacción para que dos
 * desactivaciones simultáneas no dejen al equipo sin nadie.
 */
export async function ejecutar(
  servicios: Pick<ServiciosDeSeguridad, 'pool'>,
  principal: PrincipalPlataforma,
  objetivoId: string,
  ahora: Date = new Date(),
): Promise<void> {
  const { pool } = servicios;
  const admins = new RepositorioDeSuperAdmins(pool);
  if ((await admins.buscarPorId(objetivoId)) === null) {
    throw new ErrorDeDominio('usuario.no_encontrado', 404);
  }

  await enTransaccion(pool, async (tx) => {
    const activos = await admins.idsActivosBloqueados(tx);
    if (!activos.includes(objetivoId)) return; // ya estaba desactivado: idempotente
    const motivo = motivoParaNoDesactivar(principal.usuarioId, objetivoId, activos);
    if (motivo !== null) {
      throw new ErrorDeDominio(
        motivo === 'a_si_mismo' ? 'equipo.no_desactivarse' : 'equipo.ultimo_activo',
        422,
      );
    }
    await admins.desactivar(tx, objetivoId);
    await new RepositorioDeSesionesDeSuperAdmins(pool).revocarTodasDe(tx, objetivoId, ahora);
  });
}
