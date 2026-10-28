import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { aIso } from '../../../platform/tiempo/fechas.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { crearServicioDeCuentas } from '../../seguridad/contracts.js';
import { RepositorioDeExcepciones } from '../repository.js';

export interface ExcepcionListada {
  readonly id: string;
  readonly clave: string;
  /** `null` = de la cuenta entera. */
  readonly usuario_id: string | null;
  readonly valor: number;
  readonly creada_at: string;
}

/** Las excepciones de una cuenta, las suyas y las de sus usuarios. */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
  cuentaId: string,
): Promise<ExcepcionListada[]> {
  if (!(await crearServicioDeCuentas(pool).existe(cuentaId))) {
    throw new ErrorDeDominio('cuenta.no_encontrada', 404);
  }
  return ContextoCuenta.comoPlataformaEn(cuentaId, principal.usuarioId, async () =>
    (await new RepositorioDeExcepciones(pool).listar()).map((fila) => ({
      id: fila.id,
      clave: fila.clave,
      usuario_id: fila.usuario_id,
      valor: fila.valor,
      creada_at: aIso(fila.created_at),
    })),
  );
}
