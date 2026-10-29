import type { Pool } from 'mysql2/promise';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { permisoDePlataforma, plataformaDe } from '../../plugins/permisos.js';
import { ejecutar as cancelarVinculo } from './actions/cancelar-vinculo-de-placa.js';
import { ejecutar as configurarSensor } from './actions/configurar-sensor-de-puerta.js';
import { ejecutar as darDeBaja } from './actions/dar-de-baja-placa.js';
import { ejecutar as liberar } from './actions/liberar-placa.js';
import { ejecutar as listar } from './actions/listar-placas.js';
import { ejecutar as vincular } from './actions/vincular-placa.js';
import {
  consultaDePlacas,
  cuerpoDeSensor,
  cuerpoDeVinculo,
  parametrosDePlaca,
  respuestaDePlacas,
  respuestaDeVinculo,
} from './schemas.js';

const ETIQUETA = ['plataforma'];
const plataforma = { acceso: 'plataforma' } as const;

/** Inventario y vinculación de placas para el super admin (ADR 0025 y 0026). */
export const rutasDePlacas =
  (pool: Pool): FastifyPluginCallbackZod =>
  (app, _opciones, listo) => {
    app.get(
      '/plataforma/placas',
      {
        schema: {
          tags: ETIQUETA,
          querystring: consultaDePlacas,
          response: { 200: respuestaDePlacas },
        },
        config: plataforma,
        preHandler: permisoDePlataforma('dispositivos.placa.ver'),
      },
      (request) => {
        const { busqueda, estado, conexion, ...paginacion } = request.query;
        return listar(pool, { busqueda, estado, conexion }, paginacion);
      },
    );

    app.post(
      '/plataforma/placas/:id/vincular',
      {
        schema: {
          tags: ETIQUETA,
          params: parametrosDePlaca,
          body: cuerpoDeVinculo,
          response: { 202: respuestaDeVinculo },
        },
        config: plataforma,
        preHandler: permisoDePlataforma('dispositivos.placa.vincular'),
      },
      async (request, reply) => {
        const { porConfirmarHasta } = await vincular(
          pool,
          plataformaDe(request),
          request.params.id,
          {
            cuentaId: request.body.cuenta_id,
            puertaId: request.body.puerta_id,
            nombre: request.body.nombre,
            sentido: request.body.sentido,
          },
        );
        // 202: el dispositivo todavía no existe, falta el botón de la placa (ADR 0026).
        return reply.status(202).send({ por_confirmar_hasta: porConfirmarHasta.toISOString() });
      },
    );

    app.post(
      '/plataforma/placas/:id/cancelar-vinculo',
      {
        schema: { tags: ETIQUETA, params: parametrosDePlaca },
        config: plataforma,
        preHandler: permisoDePlataforma('dispositivos.placa.vincular'),
      },
      async (request, reply) => {
        await cancelarVinculo(pool, request.params.id);
        return reply.status(204).send();
      },
    );

    app.post(
      '/plataforma/placas/:id/liberar',
      {
        schema: { tags: ETIQUETA, params: parametrosDePlaca },
        config: plataforma,
        preHandler: permisoDePlataforma('dispositivos.placa.liberar'),
      },
      async (request, reply) => {
        await liberar(pool, plataformaDe(request), request.params.id);
        return reply.status(204).send();
      },
    );

    // Habilita el sensor de puerta y fija su polaridad, tras verificarlo en campo (ADR 0031 §18).
    app.put(
      '/plataforma/placas/:id/sensor',
      {
        schema: {
          tags: ETIQUETA,
          description:
            'Configura el sensor de puerta del dispositivo en servicio de la placa. 409 `placa.sin_dispositivo` si la placa no está vinculada.',
          params: parametrosDePlaca,
          body: cuerpoDeSensor,
        },
        config: plataforma,
        preHandler: permisoDePlataforma('dispositivos.placa.vincular'),
      },
      async (request, reply) => {
        await configurarSensor(pool, plataformaDe(request), request.params.id, {
          instalado: request.body.instalado,
          nivelAbierto: request.body.nivel_abierto,
        });
        return reply.status(204).send();
      },
    );

    app.delete(
      '/plataforma/placas/:id',
      {
        schema: { tags: ETIQUETA, params: parametrosDePlaca },
        config: plataforma,
        preHandler: permisoDePlataforma('dispositivos.placa.registrar'),
      },
      async (request, reply) => {
        await darDeBaja(pool, request.params.id);
        return reply.status(204).send();
      },
    );
    listo();
  };
