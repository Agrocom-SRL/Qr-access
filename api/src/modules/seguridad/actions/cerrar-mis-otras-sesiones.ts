import type { Pool } from 'mysql2/promise';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { RepositorioDeSesiones } from '../repository.js';
import { cerrarSesiones } from '../sesiones-abiertas.js';

/**
 * Cierra todas mis sesiones MENOS la actual y devuelve cuántas cerró (ADR 0030 §4.1). No anula mis QR vigentes:
 * conservo mi sesión y, si quiero anularlos, uso la anulación de QR (ADR 0031 §3).
 */
export function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  ahora: Date = new Date(),
): Promise<number> {
  return cerrarSesiones(
    pool,
    new RepositorioDeSesiones(pool),
    principal.usuarioId,
    { motivo: 'propia', porUsuarioId: principal.usuarioId },
    ahora,
    { exceptoId: principal.sesionId },
  );
}
