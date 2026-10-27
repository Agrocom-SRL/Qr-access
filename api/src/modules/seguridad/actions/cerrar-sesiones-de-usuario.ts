import type { Pool } from 'mysql2/promise';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { crearServicioDeAnulacionDeQr } from '../../accesos/contracts.js';
import { RepositorioDeSesiones, RepositorioDeUsuarios } from '../repository.js';
import { cerrarSesiones } from '../sesiones-abiertas.js';

/**
 * Cierra TODAS las sesiones de un usuario de la rama del actor y devuelve cuántas cerró: la respuesta a un PIN
 * filtrado o a una sesión robada (ADR 0030 §4.1). Cerrar todas sus sesiones anula también sus QR vigentes en la
 * misma transacción (ADR 0031 §1); los anulados no reviven. Un usuario fuera de la rama, de otra cuenta o el
 * propio actor es 404.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  usuarioId: string,
  ahora: Date = new Date(),
): Promise<number> {
  if (
    (await new RepositorioDeUsuarios(pool).buscarEnRama(principal.usuarioId, usuarioId)) === null
  ) {
    throw new ErrorDeDominio('usuario.no_encontrado', 404);
  }
  return cerrarSesiones(
    pool,
    new RepositorioDeSesiones(pool),
    usuarioId,
    { motivo: 'superior', porUsuarioId: principal.usuarioId },
    ahora,
    {
      ademas: async (tx) => {
        await crearServicioDeAnulacionDeQr(pool).anularVigentes(
          tx,
          [usuarioId],
          principal.usuarioId,
          ahora,
        );
      },
    },
  );
}
