import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { esquemaPaginacion } from '../../platform/http/paginacion.js';
import { permiso } from '../../plugins/permisos.js';
import { ejecutar as listarPuertas } from './actions/listar-puertas.js';
import { esquemaListadoDePuertas } from './schemas.js';

export function rutas({ pool }: DependenciasDeModulo): FastifyPluginCallbackZod {
  return (app, _opciones, listo) => {
    app.get(
      '/puertas',
      {
        schema: {
          tags: ['organizacion'],
          querystring: esquemaPaginacion,
          response: { 200: esquemaListadoDePuertas },
        },
        preHandler: permiso('organizacion.puerta.ver'),
      },
      (request) => listarPuertas(pool, request.query),
    );
    listo();
  };
}
