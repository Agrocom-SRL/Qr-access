import type { Writable } from 'node:stream';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Config } from '../../config.js';
import { enviarProblema, registrarErrores } from '../errores/problema.js';
import {
  aplicarCabecerasDeSeguridad,
  registrarCabecerasDeSeguridad,
} from './cabeceras-de-seguridad.js';
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

/**
 * Un error de mysql2 trae `sql`, `sqlMessage` y `parameters`: el SQL y sus valores (un PIN, un
 * hash, un texto de QR) no llegan a ningún log (ADR 0033 §2).
 */
const CAMPOS_DE_SQL = ['sql', 'sqlMessage', 'parameters'];

export const REDACCION_DE_LOGS: readonly string[] = [
  ...CAMPOS_DE_SQL.flatMap((campo) => [`err.${campo}`, `error.${campo}`, `*.${campo}`]),
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
 * Serializador de `err` para el log. Un error de mysql2 lleva el SQL y, en su mensaje, a veces
 * un valor (`Duplicate entry 'X'`): de ese error solo se registran el código y el estado, sin
 * mensaje ni traza (ADR 0033 §2). El resto de los errores conserva tipo, mensaje y traza.
 */
export function serializarError(error: unknown): {
  type: string;
  message: string;
  stack: string;
  [campo: string]: unknown;
} {
  if (!(error instanceof Error)) return { type: typeof error, message: '', stack: '' };
  const datos = error as Error & Record<string, unknown>;
  if ('sqlMessage' in datos || 'sql' in datos) {
    return {
      type: 'ErrorDeBaseDeDatos',
      code: datos.code,
      errno: datos.errno,
      sqlState: datos.sqlState,
      message: 'Error de base de datos (detalle omitido)',
      stack: '',
    };
  }
  return { type: error.name, message: error.message, stack: error.stack ?? '' };
}

/** Confía en los `saltos` proxies más cercanos al socket (la semántica de un número en `proxy-addr`). */
function saltosDeConfianza(saltos: number): (direccion: string, salto: number) => boolean {
  return (_direccion, salto) => salto < saltos;
}

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
            serializers: { err: serializarError },
            redact: { paths: [...REDACCION_DE_LOGS], censor: '[redactado]' },
            ...(logDestino === undefined ? {} : { stream: logDestino }),
          },
    bodyLimit: LIMITE_BODY_BYTES,
    // Tope de una petición completa (ADR 0030 §3.4); las rutas del dispositivo fijan uno menor.
    handlerTimeout: config.PETICION_MS_APP,
    // Una URL mal formada se rechaza antes de enrutar: no pasa por los hooks, así que las
    // cabeceras de seguridad y el formato RFC 9457 se aplican acá (ADR 0033 §2).
    frameworkErrors: (_error, _request, reply) => {
      aplicarCabecerasDeSeguridad(reply);
      void enviarProblema(reply, 400, 'solicitud.invalida');
    },
    // La IP del cliente sale de X-Forwarded-For solo hasta los saltos o redes de confianza (nunca
    // `true`, ver `TRUST_PROXY` en config.ts): la usan el rate limit y el límite de intentos.
    trustProxy:
      typeof config.TRUST_PROXY === 'number'
        ? saltosDeConfianza(config.TRUST_PROXY)
        : config.TRUST_PROXY,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registrarCabecerasDeSeguridad(app);
  registrarErrores(app, config.REINTENTO_503_SEGUNDOS);
  return app;
}
