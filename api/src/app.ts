import type { Writable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'mysql2/promise';
import type { Config } from './config.js';
import { crearAutenticadores, MODULOS } from './modulos.js';
import { PREFIJO_API } from './platform/http/constantes.js';
import { crearServidor } from './platform/http/crear-servidor.js';
import { LimiteDeFallosDeAutenticacion } from './platform/seguridad/limite-de-fallos-de-autenticacion.js';
import { rutasSalud } from './platform/salud/routes.js';
import { registrarAutenticacion } from './plugins/autenticacion.js';
import { registrarLimites } from './plugins/limites.js';
import { registrarOpenapi } from './plugins/openapi.js';

export interface DependenciasApp {
  readonly config: Config;
  readonly pool: Pool;
  /** Pool reservado a las rutas del dispositivo (ADR 0032 §1). */
  readonly poolDispositivos: Pool;
  /** Solo para tests: adónde escribe el log (en test queda apagado si falta). */
  readonly logDestino?: Writable;
}

/**
 * Compone la API sin escuchar un puerto (`server.ts` la levanta; los tests usan `app.inject()`),
 * en este orden (ADR 0019): servidor, plugins, plataforma y módulos. Acá no hay opciones ni
 * rutas propias.
 */
export async function construirApp({
  config,
  pool,
  poolDispositivos,
  logDestino,
}: DependenciasApp): Promise<FastifyInstance> {
  const dependencias = { config, pool, poolDispositivos };
  const app = crearServidor(config, logDestino);

  await registrarOpenapi(app);
  registrarAutenticacion(
    app,
    crearAutenticadores(dependencias),
    new LimiteDeFallosDeAutenticacion({ maxFallos: config.LIMITE_FALLOS_AUTENTICACION_POR_MINUTO }),
  );
  // Después de autenticar: el límite cuenta por usuario o dispositivo, no por lo que dice una cabecera.
  await registrarLimites(app, config);

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
