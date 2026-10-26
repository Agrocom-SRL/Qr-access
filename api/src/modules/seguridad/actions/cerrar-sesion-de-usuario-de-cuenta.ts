import type { Pool } from 'mysql2/promise';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { RepositorioDeSesiones } from '../repository.js';
import { cerrarUnaSesion, enUsuarioDeCuenta } from '../sesiones-abiertas.js';

/**
 * AGROCOM cierra UNA sesión de un usuario de una cuenta (ADR 0030 §4.1). La cuenta o el usuario que no existen,
 * o el usuario de otra cuenta: 404 (`cuenta.no_encontrada` / `usuario.no_encontrado`); una sesión que no es de ese
 * usuario o ya no está viva: 404 `sesion.no_encontrada`.
 */
export function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
  cuentaId: string,
  usuarioId: string,
  sesionId: string,
  ahora: Date = new Date(),
): Promise<void> {
  return enUsuarioDeCuenta(pool, principal, cuentaId, usuarioId, () =>
    cerrarUnaSesion(
      pool,
      new RepositorioDeSesiones(pool),
      usuarioId,
      sesionId,
      { motivo: 'plataforma', porUsuarioId: principal.usuarioId },
      ahora,
    ),
  );
}
