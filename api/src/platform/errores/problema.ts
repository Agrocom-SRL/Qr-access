import type { FastifyInstance, FastifyReply } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { ErrorDeDominio } from './error-de-dominio.js';
import { esServicioNoDisponible, PoolSaturado } from './servicio-no-disponible.js';

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

export function enviarProblema(
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

/** `Retry-After` en segundos: lo piden los 429 y los 503 (ADR 0030 §3, ADR 0032 §1). */
function indicarReintento(reply: FastifyReply, segundos: number): void {
  void reply.header('retry-after', String(segundos));
}

/**
 * Todo error sale en formato RFC 9457 con un `code` estable (ADR 0005). La saturación del
 * servidor (pool lleno, consulta o petición que pasan su tope, deadlock que sobrevive al
 * reintento) sale como 503 `servicio.no_disponible` con `Retry-After`: el firmware lo trata
 * como "sin respuesta" y no abre.
 */
export function registrarErrores(app: FastifyInstance, reintentoSegundos = 2): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ErrorDeDominio) {
      // Un 429 o 503 de dominio que dice cuándo reintentar lo dice también en la cabecera.
      const espera = error.extra.reintentar_en_segundos;
      if ((error.status === 429 || error.status === 503) && typeof espera === 'number') {
        if (!reply.hasHeader('retry-after')) indicarReintento(reply, Math.ceil(espera));
      }
      return enviarProblema(reply, error.status, error.code, error.extra);
    }
    if (esServicioNoDisponible(error)) {
      // Sin el SQL ni sus valores: el serializador del log los omite (ADR 0033 §2).
      // De una petición del dispositivo se anotan su id y su puerta (no son secretos): la
      // validación que no llegó a `lecturas` queda al menos en el log (ADR 0032 §2).
      const principal = request.principal;
      request.log.warn(
        {
          err: error,
          ruta: request.routeOptions.url,
          ...(error instanceof PoolSaturado ? { motivo: error.motivo } : {}),
          ...(principal?.tipo === 'dispositivo'
            ? { dispositivoId: principal.dispositivoId, puertaId: principal.puertaId }
            : {}),
        },
        'servicio no disponible',
      );
      indicarReintento(reply, reintentoSegundos);
      return enviarProblema(reply, 503, 'servicio.no_disponible', {
        reintentar_en_segundos: reintentoSegundos,
      });
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
