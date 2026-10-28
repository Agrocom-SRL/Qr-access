import type { Pool } from 'mysql2/promise';
import { RepositorioBase, type DescripcionDeTabla } from './repositorio-base.js';

/**
 * Base para las filas de plataforma (`tenant_id IS NULL`) de una tabla que también guarda
 * filas de cuentas: `usuarios`, `sesiones`, `usuario_roles`. El filtro `tenant_id IS NULL` va
 * por construcción en cada consulta, así que nunca devuelve ni modifica datos de una cuenta
 * (invariante 1). La tabla se declara con `deCuenta: false` para que el insert deje
 * `tenant_id` en NULL.
 */
export abstract class RepositorioDeFilasDePlataforma extends RepositorioBase {
  protected constructor(pool: Pool, tabla: DescripcionDeTabla) {
    super(pool, tabla);
  }

  protected override alcance() {
    return {
      tenantId: null,
      condicion: (alias: string | null) => ({
        // eslint-disable-next-line no-restricted-syntax -- el alias es un literal interno del repositorio, no viene del usuario.
        sql: `${alias === null ? '' : `${alias}.`}tenant_id IS NULL`,
        params: [],
      }),
    };
  }
}
