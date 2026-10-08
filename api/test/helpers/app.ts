import type { FastifyInstance } from 'fastify';
import type { Pool } from 'mysql2/promise';
import { construirApp } from '../../src/app.js';
import { cargarConfig } from '../../src/config.js';
import { crearPool } from '../../src/platform/db/pool.js';

export interface AppDePrueba {
  readonly app: FastifyInstance;
  readonly pool: Pool;
  cerrar(): Promise<void>;
}

/** La API completa sobre `qr_access_testing`, sin escuchar puerto (usa `app.inject()`). */
export async function crearAppDePrueba(): Promise<AppDePrueba> {
  const config = cargarConfig();
  const pool = crearPool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_DATABASE,
    user: config.DB_USERNAME,
    password: config.DB_PASSWORD,
  });
  const app = await construirApp({ config, pool });
  return {
    app,
    pool,
    async cerrar() {
      await app.close();
      await pool.end();
    },
  };
}
