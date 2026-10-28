import type { Writable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'mysql2/promise';
import { construirApp } from '../../src/app.js';
import { cargarConfig } from '../../src/config.js';
import { crearPools } from '../../src/platform/db/pools.js';

export interface AppDePrueba {
  readonly app: FastifyInstance;
  /** Pool de la app y el panel. */
  readonly pool: Pool;
  /** Pool reservado al dispositivo. */
  readonly poolDispositivos: Pool;
  cerrar(): Promise<void>;
}

/**
 * La API completa sobre `qr_access_testing`, sin escuchar puerto (usa `app.inject()`).
 * `entorno` pisa variables de configuración (p. ej. un límite bajo para llegar a él).
 */
export async function crearAppDePrueba(
  logDestino?: Writable,
  entorno: Readonly<Record<string, string>> = {},
): Promise<AppDePrueba> {
  const config = cargarConfig({ ...process.env, ...entorno });
  const pools = crearPools(config);
  const app = await construirApp({
    config,
    pool: pools.app,
    poolDispositivos: pools.dispositivos,
    ...(logDestino === undefined ? {} : { logDestino }),
  });
  return {
    app,
    pool: pools.app,
    poolDispositivos: pools.dispositivos,
    async cerrar() {
      await app.close();
      await Promise.all([pools.app.end(), pools.dispositivos.end()]);
    },
  };
}
