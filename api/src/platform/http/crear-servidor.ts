import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Config } from '../../config.js';
import { registrarErrores } from '../errores/problema.js';
import { LIMITE_BODY_BYTES } from './constantes.js';

/**
 * Instancia de Fastify con lo que toda ruta necesita: logger sin credenciales, límite de
 * body, validación y serialización por zod, y errores RFC 9457. No registra rutas.
 */
export function crearServidor(config: Config): FastifyInstance {
  const app = Fastify({
    logger:
      config.NODE_ENV === 'test'
        ? false
        : {
            level: config.LOG_LEVEL,
            // Nunca credenciales en un log (invariante 6)
            redact: ['req.headers.authorization', 'req.headers.cookie'],
          },
    bodyLimit: LIMITE_BODY_BYTES,
    // Detrás de Nginx la IP del cliente viene en X-Forwarded-For (la usa el límite de intentos).
    trustProxy: config.TRUST_PROXY,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registrarErrores(app);
  return app;
}
