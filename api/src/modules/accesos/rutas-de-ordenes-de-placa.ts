import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { NotificadorPorClave } from '../../platform/espera/notificador-por-clave.js';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { presupuestoDePeticion } from '../../platform/http/presupuesto.js';
import { dispositivoDe } from '../../plugins/permisos.js';
import { ejecutar as entregarOrden } from './actions/entregar-orden.js';
import { ejecutar as registrarResultadoDeOrden } from './actions/registrar-resultado-de-orden.js';
import { leerHoraDelDispositivo } from './domain/hora-del-dispositivo.js';
import {
  cuerpoDeResultadoDeOrden,
  parametrosDeOrden,
  respuestaDeOrdenEntregada,
} from './schemas.js';

/**
 * Apertura manual, lado de la placa (ADR 0035 §2): la placa pregunta por órdenes con una petición larga y informa el
 * resultado. Misma credencial `Dispositivo <id>.<clave>` y mismo pool reservado que las validaciones. La orden la
 * valida y la crea la API (`abrir-puerta-manual`); la placa solo obedece una orden positiva y vigente.
 */
export function rutasDeOrdenesDePlaca(
  { poolDispositivos, config }: DependenciasDeModulo,
  notificador: NotificadorPorClave,
): FastifyPluginCallbackZod {
  return (app, _opciones, listo) => {
    app.get(
      '/dispositivos/ordenes',
      {
        schema: {
          tags: ['dispositivos'],
          description:
            'Petición larga de la placa: retiene la respuesta hasta ~20 s (`ORDENES_ESPERA_MS`). 200 con la orden que ' +
            'ESTA placa tomó (`orden_id`, `valida_por_ms` RELATIVO y `segundos_apertura`); 204 si pasó la espera sin ' +
            'orden, o de inmediato si la puerta tiene la apertura manual apagada (la placa no debe consultar en ' +
            'bucle: relee `apertura_manual` de la configuración). La orden es de la puerta: con dos placas la toma ' +
            'la primera que la reclama. La placa no abre si `valida_por_ms` ya corrió. 401 con credencial inválida.',
          response: { 200: respuestaDeOrdenEntregada, 204: z.undefined().describe('Sin orden') },
        },
        // SU propio plazo de petición (mayor que la espera) y su propio rate limit (holgado, pero no el del latido):
        // no el `handlerTimeout` de 2,5 s de las demás rutas del dispositivo (ADR 0032 §1, ADR 0035 §2).
        config: { acceso: 'dispositivo', limite: 'ordenes' },
        handlerTimeout: config.PETICION_MS_ORDENES,
      },
      async (request, reply) => {
        const orden = await entregarOrden(poolDispositivos, dispositivoDe(request), {
          esperaMs: config.ORDENES_ESPERA_MS,
          sondeoMs: config.ORDENES_SONDEO_MS,
          notificador,
          // Plazo propio o desconexión real de la placa (el `close` de la RESPUESTA); nunca `request.signal`.
          señal: presupuestoDePeticion(reply, config.PETICION_MS_ORDENES),
        });
        if (orden === null) return reply.status(204).send();
        return reply.status(200).send(orden);
      },
    );

    app.post(
      '/dispositivos/ordenes/:id/resultado',
      {
        schema: {
          tags: ['dispositivos'],
          description:
            'La placa que tomó la orden informa cómo terminó: `ejecutada`+`puerta_abrio`; `fallida`+`puerta_no_abrio`, ' +
            '`puerta_no_cerro` o `rele_no_accionado`; `sin_confirmacion`+`sin_sensor` si la puerta no tiene sensor ' +
            'habilitado. 204 si se registró o si ya estaba registrado igual (idempotente). 404 `orden.no_encontrada` ' +
            '(inexistente, de otra puerta o cuenta, sin entregar o entregada a otra placa); 409 `orden.vencida` y ' +
            '`orden.ya_resuelta` (con un resultado distinto del ya registrado).',
          params: parametrosDeOrden,
          body: cuerpoDeResultadoDeOrden,
        },
        config: { acceso: 'dispositivo' },
        handlerTimeout: config.PETICION_MS_DISPOSITIVOS,
      },
      async (request, reply) => {
        const { resultado, causa, reportado_en_dispositivo_at: reportadoEn } = request.body;
        await registrarResultadoDeOrden(
          poolDispositivos,
          dispositivoDe(request),
          request.params.id,
          {
            // El esquema ya garantiza que el par (resultado, causa) es uno de los de `confirmaciones_apertura`.
            informe: { resultado, causa } as Parameters<
              typeof registrarResultadoDeOrden
            >[3]['informe'],
            reportadoEn: leerHoraDelDispositivo(reportadoEn),
          },
          new Date(),
          presupuestoDePeticion(reply, config.PETICION_MS_DISPOSITIVOS),
        );
        return reply.status(204).send();
      },
    );
    listo();
  };
}
