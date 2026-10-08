import swagger from '@fastify/swagger';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Pool } from 'mysql2/promise';
import type { Config } from './config.js';
import { registrarErrores } from './platform/errores/problema.js';
import { rutasSalud } from './platform/salud/routes.js';

export interface DependenciasApp {
  readonly config: Config;
  readonly pool: Pool;
}

/**
 * Construye la API sin escuchar un puerto: `server.ts` la levanta y los tests la usan con
 * `app.inject()`. Los módulos (`src/modules/<modulo>/routes.ts`) se registran acá, bajo `/api/v1`.
 */
export async function construirApp({ config, pool }: DependenciasApp): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      config.NODE_ENV === 'test'
        ? false
        : {
            level: config.LOG_LEVEL,
            // Nunca credenciales en un log (invariante 6)
            redact: ['req.headers.authorization', 'req.headers.cookie'],
          },
    bodyLimit: 64 * 1024,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registrarErrores(app);

  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: { title: 'AGROCOM Acceso', version: '1' },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(
    async (v1) => {
      await v1.register(rutasSalud(pool));
      v1.get('/openapi.json', { schema: { hide: true } }, () => app.swagger());
    },
    { prefix: '/api/v1' },
  );

  return app;
}
