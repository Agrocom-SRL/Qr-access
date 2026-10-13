import type { Pool } from 'mysql2/promise';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { permisoDePlataforma, plataformaDe } from '../../plugins/permisos.js';
import { ejecutar as darDeBaja } from './actions/dar-de-baja-placa.js';
import { ejecutar as liberar } from './actions/liberar-placa.js';
import { ejecutar as listar } from './actions/listar-placas.js';
import { ejecutar as registrar } from './actions/registrar-placa.js';
import { ejecutar as vincular } from './actions/vincular-placa.js';
import {
  consultaDePlacas,
  cuerpoDeNuevaPlaca,
  cuerpoDeVinculo,
  parametrosDePlaca,
  respuestaDePlacaCreada,
  respuestaDePlacas,
  respuestaDeVinculo,
} from './schemas.js';

const ETIQUETA = ['plataforma'];
const plataforma = { acceso: 'plataforma' } as const;

/** Inventario y vinculación de placas para el super admin (ADR 0025). */
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
        const { busqueda, estado, ...paginacion } = request.query;
        return listar(pool, { busqueda, estado }, paginacion);
      },
    );

    app.post(
      '/plataforma/placas',
      {
        schema: {
          tags: ETIQUETA,
          body: cuerpoDeNuevaPlaca,
          response: { 201: respuestaDePlacaCreada },
        },
        config: plataforma,
        preHandler: permisoDePlataforma('dispositivos.placa.registrar'),
      },
      async (request, reply) => reply.status(201).send(await registrar(pool, request.body.mac)),
    );

    app.post(
      '/plataforma/placas/:id/vincular',
      {
        schema: {
          tags: ETIQUETA,
          params: parametrosDePlaca,
          body: cuerpoDeVinculo,
          response: { 201: respuestaDeVinculo },
        },
        config: plataforma,
        preHandler: permisoDePlataforma('dispositivos.placa.vincular'),
      },
      async (request, reply) => {
        const { dispositivoId } = await vincular(pool, plataformaDe(request), request.params.id, {
          cuentaId: request.body.cuenta_id,
          puertaId: request.body.puerta_id,
          nombre: request.body.nombre,
        });
        return reply.status(201).send({ dispositivo_id: dispositivoId });
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
