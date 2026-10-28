import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { crearServicioDeCuentas, crearServicioDeUsuarios } from '../../seguridad/contracts.js';
import { definicionDe, valorValido } from '../domain/claves.js';
import { RepositorioDeExcepciones } from '../repository.js';

export interface DatosDeExcepcion {
  readonly clave: string;
  /** `null` = la excepción es de la cuenta entera. */
  readonly usuarioId: string | null;
  readonly valor: number;
}

/**
 * Fija (o cambia) una excepción a un tope general para una cuenta o para un usuario de ella (ADR 0030 §7):
 * lo que AGROCOM sube tras analizar un pico, o la bolsa que amplía a una cuenta. Opera DENTRO de la cuenta
 * (ADR 0004 §7): el repositorio de cuenta la filtra por construcción, así que un usuario de otra cuenta no
 * existe (404). Una clave que no admite excepción (o que admite solo la de cuenta) responde 422.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
  cuentaId: string,
  datos: DatosDeExcepcion,
): Promise<{ id: string }> {
  const definicion = definicionDe(datos.clave);
  if (definicion === null) throw new ErrorDeDominio('limite.no_encontrado', 404);
  if (
    definicion.excepcion === 'global' ||
    (definicion.excepcion === 'cuenta' && datos.usuarioId !== null)
  ) {
    throw new ErrorDeDominio('limite.excepcion_no_permitida', 422, { clave: datos.clave });
  }
  if (!valorValido(definicion, datos.valor)) {
    throw new ErrorDeDominio('limite.valor_invalido', 422, {
      minimo: definicion.minimo,
      maximo: definicion.maximo,
    });
  }
  if (!(await crearServicioDeCuentas(pool).existe(cuentaId))) {
    throw new ErrorDeDominio('cuenta.no_encontrada', 404);
  }

  return ContextoCuenta.comoPlataformaEn(cuentaId, principal.usuarioId, async () => {
    if (datos.usuarioId !== null) {
      const existentes = await crearServicioDeUsuarios(pool).etiquetasDe([datos.usuarioId]);
      if (!existentes.has(datos.usuarioId)) throw new ErrorDeDominio('usuario.no_encontrado', 404);
    }
    const excepciones = new RepositorioDeExcepciones(pool);
    const actual = await excepciones.buscar(datos.clave, datos.usuarioId);
    return enTransaccion(pool, async (tx) => {
      if (actual === null) {
        return { id: await excepciones.crear(tx, datos.clave, datos.usuarioId, datos.valor) };
      }
      if (actual.valor !== datos.valor) await excepciones.cambiar(tx, actual.id, datos.valor);
      return { id: actual.id };
    });
  });
}
