import type { Pool } from 'mysql2/promise';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { RepositorioDeSesionesDeSuperAdmins } from '../repository.js';
import { cerrarUnaSesion } from '../sesiones-abiertas.js';

/** Cierra una sesión PROPIA del super admin; una ajena o ya cerrada es 404. Cerrar la actual equivale a salir. */
export function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
  sesionId: string,
  ahora: Date = new Date(),
): Promise<void> {
  return cerrarUnaSesion(
    pool,
    new RepositorioDeSesionesDeSuperAdmins(pool),
    principal.usuarioId,
    sesionId,
    {
      motivo: sesionId === principal.sesionId ? 'salida' : 'propia',
      porUsuarioId: principal.usuarioId,
    },
    ahora,
  );
}
