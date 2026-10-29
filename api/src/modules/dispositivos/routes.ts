import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { LimitadorDeIntentos } from '../../platform/seguridad/limitador-de-intentos.js';
import { dispositivoDe } from '../../plugins/permisos.js';
import { ejecutar as obtenerConfiguracion } from './actions/obtener-configuracion.js';
import { ejecutar as registrarLatido } from './actions/registrar-latido.js';
import { coincideConElEtag, etagDe } from './etag.js';
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

export function rutas({
  pool,
  poolDispositivos,
  config,
}: DependenciasDeModulo): FastifyPluginCallbackZod {
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
    depurarPlacas(pool).catch((error: unknown) => {
      log.error(error);
    });
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
        // Sin credencial: usa el pool de la app, para que un flood anónimo no toque el de las puertas.
        config: { acceso: 'publica', limite: 'anuncio' },
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
        config: { acceso: 'publica', limite: 'anuncio' },
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
        handlerTimeout: config.PETICION_MS_DISPOSITIVOS,
      },
      async (request, reply) => {
        await registrarLatido(poolDispositivos, dispositivoDe(request), {
          firmware: request.body.firmware,
          rssi: request.body.rssi,
          puertaAbierta: request.body.puerta_abierta,
          ...(request.body.lector_responde === undefined
            ? {}
            : { lectorResponde: request.body.lector_responde }),
          ...(request.body.sensor_puerta === undefined
            ? {}
            : { sensorPuerta: request.body.sensor_puerta }),
        });
        return reply.status(204).send();
      },
    );

    app.get(
      '/dispositivos/configuracion',
      {
        schema: {
          tags: ['dispositivos'],
          description:
            'Configuración de la puerta de la placa. Lleva `ETag`; con `If-None-Match` igual responde 304 sin cuerpo.',
          response: { 200: respuestaDeConfiguracion, 304: z.undefined().describe('Sin cambios') },
        },
        config: { acceso: 'dispositivo' },
        handlerTimeout: config.PETICION_MS_DISPOSITIVOS,
      },
      async (request, reply) => {
        const configuracion = await obtenerConfiguracion(poolDispositivos, dispositivoDe(request));
        // ETag = hash del cuerpo: la placa relee la configuración cada ~60 s y, si no cambió, recibe un 304 sin cuerpo
        // (ADR 0035 §5). Es un hash de la configuración de SU puerta, nunca un secreto.
        const etag = etagDe(configuracion);
        void reply.header('etag', etag);
        if (coincideConElEtag(request.headers['if-none-match'], etag)) {
          return reply.status(304).send();
        }
        return configuracion;
      },
    );
    listo();
  };
}
