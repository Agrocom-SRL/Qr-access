import type { FastifyReply } from 'fastify';

/**
 * Presupuesto de tiempo de una petición, como `AbortSignal`, para las transacciones que no deben
 * hacer COMMIT cuando nadie espera ya la respuesta (invariante 2, ADR 0032 §1 y §2).
 *
 * Se aborta por DOS motivos, y solo por esos:
 *  1. Vence el plazo propio: `maximoMs` contado desde que llegó la petición (`reply.elapsedTime`).
 *     Es un temporizador nuestro, no el de Fastify.
 *  2. El cliente cortó la conexión de verdad: el `close` de la RESPUESTA llegó sin que esta
 *     terminara de escribirse (`writableFinished === false`).
 *
 * NO usar `request.signal` de Fastify para esto: lo aborta con el `close` del `IncomingMessage`,
 * y Node 22 emite ese evento apenas termina de leerse el cuerpo de un POST. Con un cliente HTTP
 * real la señal ya llegaba abortada al handler y toda validación respondía 503. Con `inject()`
 * no pasa, por eso hay tests con servidor real (`test/platform/servidor-real.test.ts`).
 */
export function presupuestoDePeticion(reply: FastifyReply, maximoMs: number): AbortSignal {
  const desconexion = new AbortController();
  reply.raw.once('close', () => {
    if (!reply.raw.writableFinished) desconexion.abort();
  });
  // `timeout` no mantiene vivo el proceso y se libera solo; mínimo 1 ms para un plazo ya agotado.
  const plazo = AbortSignal.timeout(Math.max(1, Math.ceil(maximoMs - reply.elapsedTime)));
  return AbortSignal.any([plazo, desconexion.signal]);
}
