import type { Pool } from 'mysql2/promise';
import type { Config } from '../../config.js';

/** Lo único que `app.ts` entrega a cada módulo (ADR 0019): sin contenedor de inyección. */
export interface DependenciasDeModulo {
  readonly config: Config;
  /** Pool de la app y el panel. */
  readonly pool: Pool;
  /**
   * Pool reservado al dispositivo autenticado (ADR 0032 §1): validaciones, latidos y
   * configuración. Nada de la app lo usa, para que una avalancha de listados no deje a una
   * puerta esperando.
   */
  readonly poolDispositivos: Pool;
}
