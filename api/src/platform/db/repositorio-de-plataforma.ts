import type { Pool } from 'mysql2/promise';
import { RepositorioBase, type DescripcionDeTabla } from './repositorio-base.js';

/**
 * Base de las tablas de plataforma (sin `tenant_id`: planes, permisos, cuentas) y salto
 * EXPLÍCITO del aislamiento por cuenta: puede leer una tabla de cuenta sin filtrar.
 * Cada uso se justifica en el PR y se revisa línea por línea (invariante 1). Usos legítimos:
 * buscar la cuenta por su código en el login, resolver un refresh o la credencial de un
 * dispositivo antes de saber la cuenta. Nunca escribe una tabla de cuenta.
 */
export abstract class RepositorioDePlataforma extends RepositorioBase {
  protected constructor(pool: Pool, tabla: DescripcionDeTabla) {
    super(pool, tabla);
  }

  protected override alcance() {
    return { tenantId: null, condicion: () => null };
  }
}
