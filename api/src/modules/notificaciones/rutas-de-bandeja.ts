import type { Pool } from 'mysql2/promise';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { permiso, permisoDePlataforma, plataformaDe, usuarioDe } from '../../plugins/permisos.js';
import { ejecutar as contarNoLeidas } from './actions/contar-no-leidas.js';
import { ejecutar as descartar } from './actions/descartar-notificacion.js';
import { ejecutar as listar } from './actions/listar-notificaciones.js';
import { ejecutar as marcarLeida } from './actions/marcar-leida.js';
import { ejecutar as marcarTodasLeidas } from './actions/marcar-todas-leidas.js';
import {
  RepositorioDeNotificaciones,
  RepositorioDeNotificacionesDePlataforma,
} from './repository.js';
import {
  consultaDeNotificaciones,
  consultaDeNotificacionesDePlataforma,
  parametrosDeNotificacion,
  respuestaDeContador,
  respuestaDeMarcadas,
  respuestaDeNotificaciones,
} from './schemas.js';
import type { TipoDeNotificacion } from './domain/aviso.js';

const ETIQUETA = ['notificaciones'];

/**
 * Las bandejas, cada una de su dueño: la de una cuenta (el propietario, rutas `/notificaciones`) y la de
 * AGROCOM (rutas `/plataforma/notificaciones`). Una persona solo ve y toca SUS notificaciones; la de otro
 * destinatario o de otra cuenta responde 404.
 */
export function rutasDeBandeja(pool: Pool): FastifyPluginCallbackZod {
  return (app, _opciones, listo) => {
    const deCuenta = new RepositorioDeNotificaciones(pool).bandeja;
    const dePlataforma = new RepositorioDeNotificacionesDePlataforma(pool).bandeja;

    app.get(
      '/notificaciones',
      {
        schema: {
          tags: ETIQUETA,
          querystring: consultaDeNotificaciones,
          response: { 200: respuestaDeNotificaciones },
        },
        preHandler: permiso('notificaciones.aviso.ver'),
      },
      (request) => {
        const { estado, tipo, ...paginacion } = request.query;
        return listar(
          deCuenta,
          usuarioDe(request).usuarioId,
          {
            soloNoLeidas: estado === 'no_leidas',
            tipo: (tipo ?? null) as TipoDeNotificacion | null,
            cuentaId: null,
          },
          paginacion,
        );
      },
    );

    app.get(
      '/notificaciones/contador',
      {
        schema: { tags: ETIQUETA, response: { 200: respuestaDeContador } },
        preHandler: permiso('notificaciones.aviso.ver'),
      },
      (request) => contarNoLeidas(deCuenta, usuarioDe(request).usuarioId),
    );

    app.post(
      '/notificaciones/leer-todas',
      {
        schema: { tags: ETIQUETA, response: { 200: respuestaDeMarcadas } },
        preHandler: permiso('notificaciones.aviso.gestionar'),
      },
      (request) => marcarTodasLeidas(pool, deCuenta, usuarioDe(request).usuarioId),
    );

    app.post(
      '/notificaciones/:id/leer',
      {
        schema: { tags: ETIQUETA, params: parametrosDeNotificacion },
        preHandler: permiso('notificaciones.aviso.gestionar'),
      },
      async (request, reply) => {
        await marcarLeida(pool, deCuenta, usuarioDe(request).usuarioId, request.params.id);
        return reply.status(204).send();
      },
    );

    app.post(
      '/notificaciones/:id/descartar',
      {
        schema: { tags: ETIQUETA, params: parametrosDeNotificacion },
        preHandler: permiso('notificaciones.aviso.gestionar'),
      },
      async (request, reply) => {
        await descartar(pool, deCuenta, usuarioDe(request).usuarioId, request.params.id);
        return reply.status(204).send();
      },
    );

    const plataforma = { acceso: 'plataforma' } as const;

    app.get(
      '/plataforma/notificaciones',
      {
        schema: {
          tags: ETIQUETA,
          querystring: consultaDeNotificacionesDePlataforma,
          response: { 200: respuestaDeNotificaciones },
        },
        config: plataforma,
        preHandler: permisoDePlataforma('notificaciones.aviso_plataforma.ver'),
      },
      (request) => {
        const { estado, tipo, cuenta_id: cuentaId, ...paginacion } = request.query;
        return listar(
          dePlataforma,
          plataformaDe(request).usuarioId,
          {
            soloNoLeidas: estado === 'no_leidas',
            tipo: (tipo ?? null) as TipoDeNotificacion | null,
            cuentaId: cuentaId ?? null,
          },
          paginacion,
        );
      },
    );

    app.get(
      '/plataforma/notificaciones/contador',
      {
        schema: { tags: ETIQUETA, response: { 200: respuestaDeContador } },
        config: plataforma,
        preHandler: permisoDePlataforma('notificaciones.aviso_plataforma.ver'),
      },
      (request) => contarNoLeidas(dePlataforma, plataformaDe(request).usuarioId),
    );

    app.post(
      '/plataforma/notificaciones/leer-todas',
      {
        schema: { tags: ETIQUETA, response: { 200: respuestaDeMarcadas } },
        config: plataforma,
        preHandler: permisoDePlataforma('notificaciones.aviso_plataforma.gestionar'),
      },
      (request) => marcarTodasLeidas(pool, dePlataforma, plataformaDe(request).usuarioId),
    );

    app.post(
      '/plataforma/notificaciones/:id/leer',
      {
        schema: { tags: ETIQUETA, params: parametrosDeNotificacion },
        config: plataforma,
        preHandler: permisoDePlataforma('notificaciones.aviso_plataforma.gestionar'),
      },
      async (request, reply) => {
        await marcarLeida(pool, dePlataforma, plataformaDe(request).usuarioId, request.params.id);
        return reply.status(204).send();
      },
    );

    app.post(
      '/plataforma/notificaciones/:id/descartar',
      {
        schema: { tags: ETIQUETA, params: parametrosDeNotificacion },
        config: plataforma,
        preHandler: permisoDePlataforma('notificaciones.aviso_plataforma.gestionar'),
      },
      async (request, reply) => {
        await descartar(pool, dePlataforma, plataformaDe(request).usuarioId, request.params.id);
        return reply.status(204).send();
      },
    );
    listo();
  };
}
