import type { Writable } from 'node:stream';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Config } from '../../config.js';
import { registrarErrores } from '../errores/problema.js';
import { registrarCabecerasDeSeguridad } from './cabeceras-de-seguridad.js';
import { LIMITE_BODY_BYTES } from './constantes.js';

/**
 * Lo que nunca llega a un log (invariante 6, ADR 0033): credenciales, PIN, contraseñas, el
 * refresco y el texto de un QR, en cabeceras, en el cuerpo de la petición y de la respuesta.
 * pino solo admite comodines de un nivel, por eso `*.x` cubre un objeto anidado (p. ej. un
 * `err` con la petición dentro) y `req.body.x` el cuerpo directo.
 */
const CAMPOS_SECRETOS = [
  'pin',
  'contrasena',
  'contrasena_temporal',
  'actual',
  'nueva',
  'refresco',
  'refresh',
  'refresh_token',
  'acceso',
  'token',
  'texto',
  'clave',
  'secret',
  'password',
];

export const REDACCION_DE_LOGS: readonly string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  ...CAMPOS_SECRETOS.flatMap((campo) => [
    `req.body.${campo}`,
    `res.body.${campo}`,
    `body.${campo}`,
    `*.${campo}`,
  ]),
];

/**
 * Instancia de Fastify con lo que toda ruta necesita: logger sin credenciales, límite de
 * body, validación y serialización por zod, y errores RFC 9457. No registra rutas.
 */
export function crearServidor(config: Config, logDestino?: Writable): FastifyInstance {
  const app = Fastify({
    // `logDestino` solo lo usan los tests para leer lo que se escribiría en el log.
    logger:
      config.NODE_ENV === 'test' && logDestino === undefined
        ? false
        : {
            level: config.LOG_LEVEL,
            redact: { paths: [...REDACCION_DE_LOGS], censor: '[redactado]' },
            ...(logDestino === undefined ? {} : { stream: logDestino }),
          },
    bodyLimit: LIMITE_BODY_BYTES,
    // Detrás de Nginx la IP del cliente viene en X-Forwarded-For (la usa el límite de intentos).
    trustProxy: config.TRUST_PROXY,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registrarCabecerasDeSeguridad(app);
  registrarErrores(app);
  return app;
}
