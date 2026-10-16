import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { normalizarCodigoDeCuenta } from '../domain/cuentas.js';
import { RepositorioDeCuentasDePlataforma } from '../repository.js';
import type { ServiciosDeSeguridad } from '../servicios.js';

/**
 * Cambia el código de una cuenta: las 3 primeras letras del PIN de TODOS sus usuarios cambian y
 * el resto del PIN queda igual (ADR 0023). Es lo que AGROCOM hace si un código se filtra o se
 * pidió mal; nadie tiene que volver a recibir un PIN. Las sesiones abiertas siguen: el JWT usa
 * el id de la cuenta, no su código. El código anterior queda libre para otra cuenta.
 */
export async function ejecutar(
  servicios: Pick<ServiciosDeSeguridad, 'pool'>,
  cuentaId: string,
  codigoNuevo: string,
): Promise<{ codigo: string }> {
  const codigo = normalizarCodigoDeCuenta(codigoNuevo);
  if (codigo === null) throw new ErrorDeDominio('cuenta.codigo_invalido', 422);

  const cuentas = new RepositorioDeCuentasDePlataforma(servicios.pool);
  const cuenta = await cuentas.buscarPorId(cuentaId);
  if (cuenta === null) throw new ErrorDeDominio('cuenta.no_encontrada', 404);
  if (cuenta.codigo === codigo) throw new ErrorDeDominio('cuenta.codigo_sin_cambio', 422);
  const ocupante = await cuentas.buscarPorCodigo(codigo);
  if (ocupante !== null) {
    throw new ErrorDeDominio('cuenta.codigo_existente', 409, { cuenta: ocupante.nombre });
  }

  try {
    await enTransaccion(servicios.pool, (tx) => cuentas.cambiarCodigo(tx, cuenta.id, codigo));
  } catch (error) {
    // Otro alta o cambio tomó el código entre la consulta y el UPDATE.
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ER_DUP_ENTRY'
    ) {
      throw new ErrorDeDominio('cuenta.codigo_existente', 409);
    }
    throw error;
  }
  return { codigo };
}
