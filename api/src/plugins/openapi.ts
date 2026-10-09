import swagger from '@fastify/swagger';
import type { FastifyInstance } from 'fastify';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';
import { PREFIJO_API } from '../platform/http/constantes.js';

/** OpenAPI 3.1 generado desde los esquemas zod y publicado en `/api/v1/openapi.json` (ADR 0005). */
export async function registrarOpenapi(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: { title: 'AGROCOM Acceso', version: '1' },
    },
    transform: jsonSchemaTransform,
  });

  app.get(
    `${PREFIJO_API}/openapi.json`,
    { schema: { hide: true }, config: { acceso: 'publica' } },
    () => app.swagger(),
  );
}
