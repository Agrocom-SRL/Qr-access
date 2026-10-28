import type { Pool } from 'mysql2/promise';
import type { Config } from '../../config.js';
import { crearPool, type OpcionesBase } from './pool.js';

export interface Pools {
  /** App de usuarios y panel web. */
  readonly app: Pool;
  /** Reservado al dispositivo autenticado (validaciones, latidos, configuración). */
  readonly dispositivos: Pool;
}

/**
 * Los dos pools de la API (ADR 0032 §1): la prioridad de las puertas sale de separar recursos,
 * no de una cola. Una avalancha de listados agota el pool de la app y la puerta sigue
 * atendida. Los tamaños y tiempos son de configuración.
 */
export function crearPools(config: Config): Pools {
  const base: OpcionesBase = {
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_DATABASE,
    user: config.DB_USERNAME,
    password: config.DB_PASSWORD,
  };
  return {
    app: crearPool(base, {
      conexiones: config.DB_POOL_APP,
      cola: config.DB_COLA_APP,
      esperaMs: config.DB_ESPERA_MS_APP,
      consultaMs: config.DB_CONSULTA_MS_APP,
    }),
    dispositivos: crearPool(base, {
      conexiones: config.DB_POOL_DISPOSITIVOS,
      cola: config.DB_COLA_DISPOSITIVOS,
      esperaMs: config.DB_ESPERA_MS_DISPOSITIVOS,
      consultaMs: config.DB_CONSULTA_MS_DISPOSITIVOS,
    }),
  };
}
