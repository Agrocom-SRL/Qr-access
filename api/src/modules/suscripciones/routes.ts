import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { permisoDePlataforma } from '../../plugins/permisos.js';
import { ejecutar as actualizarPrecios } from './actions/actualizar-precios.js';
import { ejecutar as listarPlanes } from './actions/listar-planes.js';
import { cuerpoDePrecios, respuestaDePlanes } from './schemas.js';

const ETIQUETA = ['plataforma'];

/** Planes, suscripciones y cobranza de la plataforma (ADR 0017 y 0022); todo es del super admin. */
export function rutas({ pool }: DependenciasDeModulo): FastifyPluginCallbackZod {
  return (app, _opciones, listo) => {
    app.get(
      '/plataforma/planes',
      {
        schema: { tags: ETIQUETA, response: { 200: respuestaDePlanes } },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('suscripciones.plan.ver'),
      },
      async () => ({ datos: await listarPlanes(pool) }),
    );

    app.put(
      '/plataforma/planes/precios',
      {
        schema: { tags: ETIQUETA, body: cuerpoDePrecios },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('suscripciones.plan.editar'),
      },
      async (request, reply) => {
        await actualizarPrecios(
          pool,
          request.body.precios.map((p) => ({ planId: p.plan_id, precioAnual: p.precio_anual })),
        );
        return reply.status(204).send();
      },
    );

    listo();
  };
}
