import type { FastifyInstance, FastifyReply } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { ErrorDeDominio } from './error-de-dominio.js';

const BASE_TIPO = 'https://acceso.agrocom.com.bo/errores/';

/** Códigos para los errores 4xx que produce el propio Fastify (body inválido, límite…). */
const CODIGOS_FASTIFY: Readonly<Record<number, string>> = {
  400: 'solicitud.invalida',
  404: 'recurso.no_encontrado',
  405: 'solicitud.metodo_no_permitido',
  413: 'solicitud.demasiado_grande',
  415: 'solicitud.tipo_no_soportado',
  429: 'solicitud.demasiadas',
};

function enviarProblema(
  reply: FastifyReply,
  status: number,
  code: string,
  extra: Readonly<Record<string, unknown>> = {},
): FastifyReply {
  return reply
    .status(status)
    .type('application/problem+json')
    .send({ ...extra, type: `${BASE_TIPO}${code}`, title: code, status, code });
}

/** Todo error sale en formato RFC 9457 con un `code` estable (ADR 0005). */
export function registrarErrores(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ErrorDeDominio) {
      return enviarProblema(reply, error.status, error.code, error.extra);
    }
    if (hasZodFastifySchemaValidationErrors(error)) {
      return enviarProblema(reply, 400, 'validacion.invalida', {
        errores: error.validation.map((v) => ({ campo: v.instancePath, code: v.keyword })),
      });
    }
    const status =
      typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number(error.statusCode)
        : 500;
    if (status >= 400 && status < 500) {
      return enviarProblema(reply, status, CODIGOS_FASTIFY[status] ?? 'solicitud.invalida');
    }
    // Lo inesperado se registra completo en el log y sale sin detalles al cliente.
    request.log.error({ err: error }, 'error no controlado');
    return enviarProblema(reply, 500, 'interno');
  });

  app.setNotFoundHandler((_request, reply) => enviarProblema(reply, 404, 'recurso.no_encontrado'));
}
