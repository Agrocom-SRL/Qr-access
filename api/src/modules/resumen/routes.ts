import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { permisoDePlataforma } from '../../plugins/permisos.js';
import { ejecutar as verEstadisticas } from './actions/ver-estadisticas.js';
import { ejecutar as verResumen } from './actions/ver-resumen.js';
import { ejecutar as listarEventos } from './actions/listar-eventos-de-acceso.js';
import {
  consultaDeEventosDePlataforma,
  respuestaDeEstadisticas,
  respuestaDeEventosDePlataforma,
  respuestaDeResumen,
} from './schemas.js';

/** El tablero de la plataforma para el super admin (A02). */
export function rutas({ pool }: DependenciasDeModulo): FastifyPluginCallbackZod {
  return (app, _opciones, listo) => {
    app.get(
      '/plataforma/resumen',
      {
        schema: { tags: ['plataforma'], response: { 200: respuestaDeResumen } },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('resumen.panel.ver'),
      },
      () => verResumen(pool),
    );
    app.get(
      '/plataforma/estadisticas',
      {
        schema: { tags: ['plataforma'], response: { 200: respuestaDeEstadisticas } },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('resumen.panel.ver'),
      },
      () => verEstadisticas(pool),
    );
    app.get(
      '/plataforma/eventos-acceso',
      {
        schema: {
          tags: ['plataforma'],
          querystring: consultaDeEventosDePlataforma,
          response: { 200: respuestaDeEventosDePlataforma },
        },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('resumen.panel.ver'),
      },
      (request) => {
        const { pagina, por_pagina, cuenta_id, resultado, desde, hasta } = request.query;
        return listarEventos(
          pool,
          {
            cuentaId: cuenta_id ?? null,
            resultado: resultado ?? null,
            desde: desde ?? null,
            hasta: hasta ?? null,
          },
          { pagina, por_pagina },
        );
      },
    );
    listo();
  };
}
