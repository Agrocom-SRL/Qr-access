import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../contexto/contexto-cuenta.js';
import {
  RepositorioBase,
  UsoIndebidoDeRepositorio,
  type DescripcionDeTabla,
} from './repositorio-base.js';

/**
 * Base de toda tabla con `tenant_id` (invariante 1, ADR 0004). Cada consulta agrega
 * `tenant_id = <cuenta del contexto>` por construcción; sin contexto, lanza
 * `SinContextoDeCuenta` (falla cerrado). Un módulo nunca escribe un `WHERE tenant_id`.
 */
export abstract class RepositorioDeCuenta extends RepositorioBase {
  protected constructor(pool: Pool, tabla: DescripcionDeTabla) {
    if (!tabla.deCuenta) {
      throw new UsoIndebidoDeRepositorio(
        `${tabla.nombre} no tiene tenant_id: usa RepositorioDePlataforma`,
      );
    }
    super(pool, tabla);
  }

  protected override alcance() {
    const cuentaId = ContextoCuenta.cuentaRequerida();
    return {
      tenantId: cuentaId,
      condicion: (alias: string | null) => ({
        sql: `${alias === null ? '' : `${alias}.`}tenant_id = ?`,
        params: [cuentaId],
      }),
    };
  }
}
