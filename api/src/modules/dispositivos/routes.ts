import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { LimitadorDeIntentos } from '../../platform/seguridad/limitador-de-intentos.js';
import { dispositivoDe } from '../../plugins/permisos.js';
import { ejecutar as obtenerConfiguracion } from './actions/obtener-configuracion.js';
import { ejecutar as registrarLatido } from './actions/registrar-latido.js';
import { rutasDePlacas } from './rutas-placas.js';
import {
  cuerpoDeAnuncio,
  cuerpoDeConfirmacion,
  cuerpoDeLatido,
  respuestaDeAnuncio,
  respuestaDeConfiguracion,
  respuestaDeConfirmacion,
} from './schemas.js';
import { ejecutar as anunciarPlaca } from './actions/anunciar-placa.js';
import { ejecutar as confirmarPlaca } from './actions/confirmar-placa.js';
import { ejecutar as depurarPlacas } from './actions/depurar-placas.js';

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
    // Placas nuevas por IP: una instalación entera sale por una misma IP, así que el tope es holgado.
    nuevasPorIp: new LimitadorDeIntentos({
      maxFallos: 30,
      bloqueoBaseSegundos: 300,
      bloqueoMaximoSegundos: 3600,
    }),
  };
  // La limpieza del inventario corre a lo sumo una vez por hora, colgada de un anuncio.
  let ultimaDepuracion = Date.now();
  const depurarSiToca = (log: { error: (error: unknown) => void }): void => {
    if (Date.now() - ultimaDepuracion < 3_600_000) return;
    ultimaDepuracion = Date.now();
    depurarPlacas(pool).catch((error: unknown) => log.error(error));
  };
  return (app, _opciones, listo) => {
    app.register(rutasDePlacas(pool));

    // Sin credencial de dispositivo: la placa aún no tiene vínculo (ADR 0026 §2).
    app.post(
      '/dispositivos/anunciar',
      {
        schema: {
          tags: ['dispositivos'],
          body: cuerpoDeAnuncio,
          response: { 200: respuestaDeAnuncio },
        },
        config: { acceso: 'publica' },
      },
      (request) => {
        depurarSiToca(request.log);
        return anunciarPlaca(pool, limitadores, {
          mac: request.body.mac,
          clave: request.body.clave,
          firmware: request.body.firmware,
          ip: request.ip,
        });
      },
    );

    // Alguien mantuvo pulsado el botón de la placa: la prueba de presencia física (ADR 0026 §4).
    app.post(
      '/dispositivos/confirmar',
      {
        schema: {
          tags: ['dispositivos'],
          body: cuerpoDeConfirmacion,
          response: { 200: respuestaDeConfirmacion },
        },
        config: { acceso: 'publica' },
      },
      (request) =>
        confirmarPlaca(pool, limitadores, {
          mac: request.body.mac,
          clave: request.body.clave,
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
