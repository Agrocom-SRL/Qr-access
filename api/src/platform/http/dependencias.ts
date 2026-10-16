import type { Pool } from 'mysql2/promise';
import type { Config } from '../../config.js';

/** Lo único que `app.ts` entrega a cada módulo (ADR 0019): sin contenedor de inyección. */
export interface DependenciasDeModulo {
  readonly config: Config;
  readonly pool: Pool;
}
