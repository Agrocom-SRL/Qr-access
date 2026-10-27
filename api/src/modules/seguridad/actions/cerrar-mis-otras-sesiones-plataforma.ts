import type { Pool } from 'mysql2/promise';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { RepositorioDeSesionesDeSuperAdmins } from '../repository.js';
import { cerrarSesiones } from '../sesiones-abiertas.js';

/** Cierra todas las sesiones del super admin menos la actual y devuelve cuántas cerró. */
export function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
  ahora: Date = new Date(),
): Promise<number> {
  return cerrarSesiones(
    pool,
    new RepositorioDeSesionesDeSuperAdmins(pool),
    principal.usuarioId,
    { motivo: 'propia', porUsuarioId: principal.usuarioId },
    ahora,
    { exceptoId: principal.sesionId },
  );
}
