import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import {
  RepositorioDeCuentasDePlataforma,
  RepositorioDeDatosDeEmpresa,
  type DatosDeEmpresa,
} from '../repository.js';

export interface CorreccionDeCuenta extends DatosDeEmpresa {
  readonly razonSocial: string;
  /** Tope de Miembros por Titular (ADR 0028 §6); sin él, se deja el que tiene. */
  readonly maxMiembrosPorTitular?: number | undefined;
}

/**
 * Corrige los datos de una cuenta: la razón social, los de la empresa y su persona responsable y,
 * si se manda, el tope de Miembros por Titular.
 * El código no se toca acá (tiene su propia acción, ADR 0023). Todo o nada; si la cuenta aún no
 * tenía datos de empresa (cuentas anteriores al panel), se crean.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
  cuentaId: string,
  datos: CorreccionDeCuenta,
): Promise<void> {
  const cuentas = new RepositorioDeCuentasDePlataforma(pool);
  const cuenta = await cuentas.buscarPorId(cuentaId);
  if (cuenta === null) throw new ErrorDeDominio('cuenta.no_encontrada', 404);

  await ContextoCuenta.comoPlataformaEn(cuenta.id, principal.usuarioId, async () => {
    const empresa = new RepositorioDeDatosDeEmpresa(pool);
    const actual = await empresa.buscar();
    await enTransaccion(pool, async (tx) => {
      if (cuenta.nombre !== datos.razonSocial) {
        await cuentas.renombrar(tx, cuenta.id, datos.razonSocial);
      }
      if (
        datos.maxMiembrosPorTitular !== undefined &&
        datos.maxMiembrosPorTitular !== cuenta.max_miembros_por_titular
      ) {
        await cuentas.cambiarMaxMiembros(tx, cuenta.id, datos.maxMiembrosPorTitular);
      }
      if (actual === null) await empresa.crear(tx, datos);
      else await empresa.corregir(tx, actual.id, datos);
    });
  });
}
