import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { presupuestoDePeticion } from '../../platform/http/presupuesto.js';
import { permiso, usuarioDe } from '../../plugins/permisos.js';
import { ejecutar as abrirPuertaManual } from './actions/abrir-puerta-manual.js';
import { ejecutar as consultarOrdenDeApertura } from './actions/consultar-orden-de-apertura.js';
import {
  cabecerasDeApertura,
  parametrosDeOrden,
  parametrosDePuertaAAbrir,
  respuestaDeEstadoDeOrden,
  respuestaDeOrdenDeApertura,
} from './schemas.js';

/**
 * Rutas de la apertura manual del lado de la app (ADR 0035). La configuración (encender o apagar) y el listado de
 * puertas viven en `organizacion`, que es dueña de `puertas`; el lado de la placa (`/dispositivos/ordenes`) va aparte.
 */
export function rutasDeAperturaManual({
  pool,
  config,
}: DependenciasDeModulo): FastifyPluginCallbackZod {
  return (app, _opciones, listo) => {
    app.post(
      '/puertas/:puertaId/abrir',
      {
        schema: {
          tags: ['accesos'],
          description:
            'Pide abrir una puerta desde la app (ADR 0035). Valida como un QR (usuario activo, suscripción vigente, ' +
            'puerta de la cuenta con la apertura manual encendida) y, si pasa, crea la orden que la placa de la ' +
            'puerta tomará: 202 con `orden_id`, `estado` y `vence_at` (15 s). No lleva cuerpo ni sentido. ' +
            '`Idempotency-Key` OBLIGATORIA (UUID o base64url de 22 a 128 caracteres): un reintento con la misma ' +
            'clave devuelve la misma orden con `Idempotent-Replayed: true`; la misma clave sobre otra puerta es 422 ' +
            '`idempotencia.conflicto`. Errores: 404 `puerta.no_encontrada` (no es de la cuenta); 409 ' +
            '`manual.no_habilitada`, `puerta.sin_dispositivo`, `puerta.sin_conexion`, `manual.orden_en_curso`; ' +
            '403 `suscripcion.vencida`, `manual.usuario_restringido`, `manual.usuario_suspendido`, ' +
            '`manual.cuenta_suspendida`, `manual.usuario_eliminado`; 429 `manual.limite` (`tipo`: `enfriamiento` o ' +
            '`diario`, con `reintentar_en_segundos`). Toda petición, aceptada o rechazada, queda en `lecturas`.',
          params: parametrosDePuertaAAbrir,
          headers: cabecerasDeApertura,
          response: { 202: respuestaDeOrdenDeApertura },
        },
        preHandler: permiso('accesos.apertura_manual.usar'),
      },
      async (request, reply) => {
        const orden = await abrirPuertaManual(
          pool,
          usuarioDe(request),
          {
            puertaId: request.params.puertaId,
            idempotencia: {
              clave: request.headers['idempotency-key'],
              secreto: config.QR_IDEMPOTENCIA_CLAVE,
            },
            log: request.log,
          },
          new Date(),
          // Plazo propio o desconexión real del cliente; nunca `request.signal` (ver presupuesto.ts).
          presupuestoDePeticion(reply, config.PETICION_MS_APP),
        );
        if (orden.repetida === true) void reply.header('Idempotent-Replayed', 'true');
        return reply.status(202).send({
          orden_id: orden.orden_id,
          estado: orden.estado,
          vence_at: orden.vence_at,
        });
      },
    );

    app.get(
      '/ordenes-apertura/:id',
      {
        schema: {
          tags: ['accesos'],
          description:
            'Cómo va una orden de abrir (la app la consulta cada segundo): `estado` (`pendiente`, `entregada`, ' +
            '`ejecutada`, `fallida`, `vencida`) y, si existe, `resultado` de la placa. Solo las órdenes del propio ' +
            'usuario; la de otro usuario o de otra cuenta es 404 `orden.no_encontrada`.',
          params: parametrosDeOrden,
          response: { 200: respuestaDeEstadoDeOrden },
        },
        preHandler: permiso('accesos.apertura_manual.usar'),
      },
      (request) => consultarOrdenDeApertura(pool, usuarioDe(request), request.params.id),
    );

    listo();
  };
}
