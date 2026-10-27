import type { Pool } from 'mysql2/promise';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { crearServicioDeAnulacionDeQr } from '../../accesos/contracts.js';
import { RepositorioDeSesiones } from '../repository.js';
import { cerrarSesiones, enUsuarioDeCuenta } from '../sesiones-abiertas.js';

/**
 * AGROCOM cierra TODAS las sesiones de un usuario de una cuenta y devuelve cuántas cerró (ADR 0030 §4.1). Igual
 * que el superior de la cuenta, anula en la misma transacción los QR vigentes del usuario (ADR 0031 §1).
 */
export function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
  cuentaId: string,
  usuarioId: string,
  ahora: Date = new Date(),
): Promise<number> {
  return enUsuarioDeCuenta(pool, principal, cuentaId, usuarioId, () =>
    cerrarSesiones(
      pool,
      new RepositorioDeSesiones(pool),
      usuarioId,
      { motivo: 'plataforma', porUsuarioId: principal.usuarioId },
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
    ),
  );
}
