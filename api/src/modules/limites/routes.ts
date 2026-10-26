import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { permisoDePlataforma, plataformaDe } from '../../plugins/permisos.js';
import { ejecutar as editarConfiguracion } from './actions/editar-configuracion.js';
import { ejecutar as fijarExcepcion } from './actions/fijar-excepcion.js';
import { ejecutar as listarExcepciones } from './actions/listar-excepciones.js';
import { ejecutar as quitarExcepcion } from './actions/quitar-excepcion.js';
import { ejecutar as verConfiguracion } from './actions/ver-configuracion.js';
import {
  cuerpoDeExcepcion,
  cuerpoDeLimite,
  parametrosDeCuentaDeLimites,
  parametrosDeExcepcion,
  parametrosDeLimite,
  respuestaDeExcepcionFijada,
  respuestaDeExcepciones,
  respuestaDeLimites,
} from './schemas.js';

const ETIQUETA = ['plataforma'];

/**
 * Configuración de los topes de generación de QR (ADR 0030 §7): los valores generales y las excepciones por
 * cuenta o por usuario. Es todo del super admin; cada cambio queda en la bitácora.
 */
export function rutas({ pool }: DependenciasDeModulo): FastifyPluginCallbackZod {
  return (app, _opciones, listo) => {
    app.get(
      '/plataforma/limites',
      {
        schema: { tags: ETIQUETA, response: { 200: respuestaDeLimites } },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('limites.configuracion.ver'),
      },
      async () => ({ datos: await verConfiguracion(pool) }),
    );

    app.put(
      '/plataforma/limites/:clave',
      {
        schema: { tags: ETIQUETA, params: parametrosDeLimite, body: cuerpoDeLimite },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('limites.configuracion.editar'),
      },
      async (request, reply) => {
        await editarConfiguracion(pool, request.params.clave, request.body.valor);
        return reply.status(204).send();
      },
    );

    app.get(
      '/plataforma/cuentas/:cuenta_id/excepciones-de-limite',
      {
        schema: {
          tags: ETIQUETA,
          params: parametrosDeCuentaDeLimites,
          response: { 200: respuestaDeExcepciones },
        },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('limites.configuracion.ver'),
      },
      async (request) => ({
        datos: await listarExcepciones(pool, plataformaDe(request), request.params.cuenta_id),
      }),
    );

    app.put(
      '/plataforma/cuentas/:cuenta_id/excepciones-de-limite',
      {
        schema: {
          tags: ETIQUETA,
          params: parametrosDeCuentaDeLimites,
          body: cuerpoDeExcepcion,
          response: { 200: respuestaDeExcepcionFijada },
        },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('limites.configuracion.editar'),
      },
      (request) =>
        fijarExcepcion(pool, plataformaDe(request), request.params.cuenta_id, {
          clave: request.body.clave,
          usuarioId: request.body.usuario_id ?? null,
          valor: request.body.valor,
        }),
    );

    app.delete(
      '/plataforma/cuentas/:cuenta_id/excepciones-de-limite/:id',
      {
        schema: { tags: ETIQUETA, params: parametrosDeExcepcion },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('limites.configuracion.editar'),
      },
      async (request, reply) => {
        await quitarExcepcion(
          pool,
          plataformaDe(request),
          request.params.cuenta_id,
          request.params.id,
        );
        return reply.status(204).send();
      },
    );

    listo();
  };
}
