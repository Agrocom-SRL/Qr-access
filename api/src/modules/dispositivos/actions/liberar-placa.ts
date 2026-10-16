import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { RepositorioDeDispositivos, RepositorioDeDispositivosDePlataforma } from '../repository.js';

/**
 * Libera una placa (ADR 0026 §7): revoca su dispositivo. La placa recibe 401, borra su vínculo,
 * sortea una clave nueva y vuelve a anunciarse como detectada, lista para otra cuenta tras una
 * nueva confirmación física. Si el dispositivo es de una cuenta, se revoca en su contexto para
 * que la bitácora quede en esa cuenta.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
  placaId: string,
  ahora: Date = new Date(),
): Promise<void> {
  const dispositivo = await new RepositorioDeDispositivosDePlataforma(pool).buscarEnServicioDePlaca(
    placaId,
  );
  if (dispositivo === null) throw new ErrorDeDominio('placa.sin_dispositivo', 409);

  await ContextoCuenta.comoPlataformaEn(dispositivo.cuentaId, principal.usuarioId, () =>
    enTransaccion(pool, async (tx) => {
      const revocado = await new RepositorioDeDispositivos(pool).revocar(tx, dispositivo.id, ahora);
      if (!revocado) throw new ErrorDeDominio('placa.sin_dispositivo', 409);
    }),
  );
}
