import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { LimitadorDeIntentos } from '../../platform/seguridad/limitador-de-intentos.js';
import { dispositivoDe } from '../../plugins/permisos.js';
import { ejecutar as obtenerConfiguracion } from './actions/obtener-configuracion.js';
import { ejecutar as registrarLatido } from './actions/registrar-latido.js';
import { rutasDePlacas } from './rutas-placas.js';
import {
  cuerpoDeLatido,
  cuerpoDeReclamo,
  respuestaDeConfiguracion,
  respuestaDeReclamo,
} from './schemas.js';
import { ejecutar as reclamarPlaca } from './actions/reclamar-placa.js';

export function rutas({ pool }: DependenciasDeModulo): FastifyPluginCallbackZod {
  // En memoria: vale para una sola instancia de la API (V1), igual que el límite del login.
  const limitadores = {
    porIp: new LimitadorDeIntentos({
      maxFallos: 10,
      bloqueoBaseSegundos: 60,
      bloqueoMaximoSegundos: 3600,
    }),
    porMac: new LimitadorDeIntentos({
      maxFallos: 10,
      bloqueoBaseSegundos: 60,
      bloqueoMaximoSegundos: 3600,
    }),
  };
  return (app, _opciones, listo) => {
    app.register(rutasDePlacas(pool));

    // Sin credencial de dispositivo: la placa aún no tiene vínculo (ADR 0025 §5).
    app.post(
      '/dispositivos/reclamar',
      {
        schema: {
          tags: ['dispositivos'],
          body: cuerpoDeReclamo,
          response: { 200: respuestaDeReclamo },
        },
        config: { acceso: 'publica' },
      },
      (request) =>
        reclamarPlaca(pool, limitadores, {
          mac: request.body.mac,
          codigo: request.body.codigo,
          clave: request.body.clave,
          firmware: request.body.firmware,
          ip: request.ip,
        }),
    );

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
