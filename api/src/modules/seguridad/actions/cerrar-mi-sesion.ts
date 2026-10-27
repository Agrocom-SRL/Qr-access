import type { Pool } from 'mysql2/promise';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { RepositorioDeSesiones } from '../repository.js';
import { cerrarUnaSesion } from '../sesiones-abiertas.js';

/**
 * Cierra una sesión PROPIA (ADR 0030 §4.1): su refresh y su JWT de acceso dejan de servir en el acto. Una sesión
 * de otro usuario, de otra cuenta, ya cerrada o vencida no existe (404). Cerrar la actual equivale a salir.
 */
export function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  sesionId: string,
  ahora: Date = new Date(),
): Promise<void> {
  return cerrarUnaSesion(
    pool,
    new RepositorioDeSesiones(pool),
    principal.usuarioId,
    sesionId,
    {
      motivo: sesionId === principal.sesionId ? 'salida' : 'propia',
      porUsuarioId: principal.usuarioId,
    },
    ahora,
  );
}
