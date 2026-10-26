import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { RepositorioDeExcepciones } from '../repository.js';

/**
 * Quita una excepción: el tope vuelve al general. Se busca dentro de la cuenta pedida, así que la excepción
 * de otra cuenta no existe (404, invariante 1). Es un soft delete y queda en la bitácora.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
  cuentaId: string,
  excepcionId: string,
): Promise<void> {
  await ContextoCuenta.comoPlataformaEn(cuentaId, principal.usuarioId, async () => {
    const excepciones = new RepositorioDeExcepciones(pool);
    if ((await excepciones.buscarPorId(excepcionId)) === null) {
      throw new ErrorDeDominio('limite.excepcion_no_encontrada', 404);
    }
    await enTransaccion(pool, (tx) => excepciones.quitar(tx, excepcionId));
  });
}
