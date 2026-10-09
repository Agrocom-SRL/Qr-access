import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { usuarioDe } from '../../plugins/permisos.js';
import { ejecutar as cambiarRolActivo } from './actions/cambiar-rol-activo.js';
import { ejecutar as cerrarSesion } from './actions/cerrar-sesion.js';
import { ejecutar as iniciarSesion } from './actions/iniciar-sesion.js';
import { ejecutar as refrescarSesion } from './actions/refrescar-sesion.js';
import { ejecutar as verSesionActual } from './actions/ver-sesion-actual.js';
import {
  cuerpoDeIngreso,
  cuerpoDeRefresco,
  cuerpoDeRolActivo,
  respuestaDeIngreso,
  respuestaDeRefresco,
  respuestaDeRolActivo,
  respuestaDeSesionActual,
} from './schemas.js';
import { crearServiciosDeSeguridad } from './servicios.js';

const LARGO_MAXIMO_DEL_AGENTE = 255;

export function rutas(dependencias: DependenciasDeModulo): FastifyPluginCallbackZod {
  const servicios = crearServiciosDeSeguridad(dependencias);

  return (app, _opciones, listo) => {
    app.post(
      '/sesiones',
      {
        schema: {
          tags: ['seguridad'],
          body: cuerpoDeIngreso,
          response: { 200: respuestaDeIngreso },
        },
        config: { acceso: 'publica' },
      },
      (request) =>
        iniciarSesion(servicios, {
          pin: request.body.pin,
          ip: request.ip,
          agente: request.headers['user-agent']?.slice(0, LARGO_MAXIMO_DEL_AGENTE) ?? null,
          log: request.log,
        }),
    );

    app.post(
      '/sesiones/refresco',
      {
        schema: {
          tags: ['seguridad'],
          body: cuerpoDeRefresco,
          response: { 200: respuestaDeRefresco },
        },
        config: { acceso: 'publica' },
      },
      (request) => refrescarSesion(servicios, request.body.refresco),
    );

    app.post(
      '/sesiones/rol-activo',
      {
        schema: {
          tags: ['seguridad'],
          body: cuerpoDeRolActivo,
          response: { 200: respuestaDeRolActivo },
        },
      },
      (request) => cambiarRolActivo(servicios, usuarioDe(request), request.body.rol_id),
    );

    app.get(
      '/sesiones/actual',
      { schema: { tags: ['seguridad'], response: { 200: respuestaDeSesionActual } } },
      (request) => verSesionActual(servicios.pool, usuarioDe(request)),
    );

    app.delete('/sesiones/actual', { schema: { tags: ['seguridad'] } }, async (request, reply) => {
      await cerrarSesion(servicios, usuarioDe(request));
      return reply.status(204).send();
    });
    listo();
  };
}
