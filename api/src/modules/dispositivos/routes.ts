import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { dispositivoDe } from '../../plugins/permisos.js';
import { ejecutar as obtenerConfiguracion } from './actions/obtener-configuracion.js';
import { ejecutar as registrarLatido } from './actions/registrar-latido.js';
import { cuerpoDeLatido, respuestaDeConfiguracion } from './schemas.js';

export function rutas({ pool }: DependenciasDeModulo): FastifyPluginCallbackZod {
  return (app, _opciones, listo) => {
    app.post(
      '/dispositivos/latidos',
      {
        schema: { tags: ['dispositivos'], body: cuerpoDeLatido },
        config: { acceso: 'dispositivo' },
      },
      async (request, reply) => {
        await registrarLatido(pool, dispositivoDe(request), {
          firmware: request.body.firmware,
          rssi: request.body.rssi,
          puertaAbierta: request.body.puerta_abierta,
        });
        return reply.status(204).send();
      },
    );

    app.get(
      '/dispositivos/configuracion',
      {
        schema: { tags: ['dispositivos'], response: { 200: respuestaDeConfiguracion } },
        config: { acceso: 'dispositivo' },
      },
      (request) => obtenerConfiguracion(pool, dispositivoDe(request)),
    );
    listo();
  };
}
