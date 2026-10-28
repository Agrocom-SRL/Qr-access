import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { definicionDe, valorValido } from '../domain/claves.js';
import { RepositorioDeConfiguracion } from '../repository.js';

/**
 * Cambia un tope general de la plataforma (ADR 0030 §7). La clave tiene que existir en el catálogo y el valor
 * quedar entre sus extremos; el cambio entra a la bitácora con el valor de antes y el de después. Vale desde la
 * próxima generación, para todas las cuentas que no tengan una excepción.
 */
export async function ejecutar(pool: Pool, clave: string, valor: number): Promise<void> {
  const definicion = definicionDe(clave);
  if (definicion === null) throw new ErrorDeDominio('limite.no_encontrado', 404);
  if (!valorValido(definicion, valor)) {
    throw new ErrorDeDominio('limite.valor_invalido', 422, {
      minimo: definicion.minimo,
      maximo: definicion.maximo,
    });
  }
  const configuracion = new RepositorioDeConfiguracion(pool);
  const actual = await configuracion.buscarPorClave(clave);
  if (actual?.valor === valor) return;
  await enTransaccion(pool, async (tx) => {
    if (actual === null) await configuracion.crear(tx, clave, valor);
    else await configuracion.cambiar(tx, actual.id, valor);
  });
}
