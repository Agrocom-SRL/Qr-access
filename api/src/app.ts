import type { FastifyInstance } from 'fastify';
import type { Pool } from 'mysql2/promise';
import type { Config } from './config.js';
import { crearAutenticadores, MODULOS } from './modulos.js';
import { PREFIJO_API } from './platform/http/constantes.js';
import { crearServidor } from './platform/http/crear-servidor.js';
import { rutasSalud } from './platform/salud/routes.js';
import { registrarAutenticacion } from './plugins/autenticacion.js';
import { registrarOpenapi } from './plugins/openapi.js';

export interface DependenciasApp {
  readonly config: Config;
  readonly pool: Pool;
}

/**
 * Compone la API sin escuchar un puerto (`server.ts` la levanta; los tests usan `app.inject()`),
 * en este orden (ADR 0019): servidor, plugins, plataforma y módulos. Acá no hay opciones ni
 * rutas propias.
 */
export async function construirApp({ config, pool }: DependenciasApp): Promise<FastifyInstance> {
  const dependencias = { config, pool };
  const app = crearServidor(config);

  await registrarOpenapi(app);
  registrarAutenticacion(app, crearAutenticadores(dependencias));

  await app.register(
    async (v1) => {
      await v1.register(rutasSalud(pool));
      for (const modulo of MODULOS) {
        await v1.register(modulo.rutas(dependencias));
      }
    },
    { prefix: PREFIJO_API },
  );

  return app;
}
