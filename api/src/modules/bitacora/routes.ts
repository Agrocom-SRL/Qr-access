import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { permisoDePlataforma } from '../../plugins/permisos.js';
import { ejecutar as listarBitacora } from './actions/listar-bitacora.js';
import { consultaDeBitacora, respuestaDeBitacora } from './schemas.js';

/** La bitácora de la plataforma para el super admin (ADR 0007, A10 y A05d). */
export function rutas({ pool }: DependenciasDeModulo): FastifyPluginCallbackZod {
  return (app, _opciones, listo) => {
    app.get(
      '/plataforma/bitacora',
      {
        schema: {
          tags: ['plataforma'],
          querystring: consultaDeBitacora,
          response: { 200: respuestaDeBitacora },
        },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('bitacora.registro.ver'),
      },
      (request) => {
        const { cuenta_id, accion, desde, hasta, ...paginacion } = request.query;
        return listarBitacora(pool, { cuentaId: cuenta_id, accion, desde, hasta }, paginacion);
      },
    );
    listo();
  };
}
