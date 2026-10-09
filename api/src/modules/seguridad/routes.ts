import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { esquemaPaginacion } from '../../platform/http/paginacion.js';
import { permiso, usuarioDe } from '../../plugins/permisos.js';
import { ejecutar as cambiarRolActivo } from './actions/cambiar-rol-activo.js';
import { ejecutar as cerrarSesion } from './actions/cerrar-sesion.js';
import { ejecutar as crearUsuario } from './actions/crear-usuario.js';
import { ejecutar as editarUsuario } from './actions/editar-usuario.js';
import { ejecutar as eliminarUsuario } from './actions/eliminar-usuario.js';
import { ejecutar as generarPin } from './actions/generar-pin.js';
import { ejecutar as iniciarSesion } from './actions/iniciar-sesion.js';
import { ejecutar as listarRoles } from './actions/listar-roles.js';
import { ejecutar as listarUsuarios } from './actions/listar-usuarios.js';
import { ejecutar as refrescarSesion } from './actions/refrescar-sesion.js';
import { ejecutar as verSesionActual } from './actions/ver-sesion-actual.js';
import {
  cuerpoDeEdicionDeUsuario,
  cuerpoDeIngreso,
  cuerpoDeNuevoUsuario,
  cuerpoDeRefresco,
  cuerpoDeRolActivo,
  esquemaUsuario,
  parametrosDeUsuario,
  respuestaDeIngreso,
  respuestaDePinGenerado,
  respuestaDeRefresco,
  respuestaDeRolActivo,
  respuestaDeSesionActual,
  respuestaDeUsuarioCreado,
  respuestaListadoDeRoles,
  respuestaListadoDeUsuarios,
} from './schemas.js';
import { crearServiciosDeSeguridad } from './servicios.js';

const LARGO_MAXIMO_DEL_AGENTE = 255;

export function rutas(dependencias: DependenciasDeModulo): FastifyPluginCallbackZod {
  const servicios = crearServiciosDeSeguridad(dependencias);
  const { pool } = servicios;

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
      (request) => verSesionActual(pool, usuarioDe(request)),
    );

    app.delete('/sesiones/actual', { schema: { tags: ['seguridad'] } }, async (request, reply) => {
      await cerrarSesion(servicios, usuarioDe(request));
      return reply.status(204).send();
    });

    app.get(
      '/roles',
      {
        schema: { tags: ['seguridad'], response: { 200: respuestaListadoDeRoles } },
        preHandler: permiso('seguridad.usuario.ver'),
      },
      () => listarRoles(pool),
    );

    app.get(
      '/usuarios',
      {
        schema: {
          tags: ['seguridad'],
          querystring: esquemaPaginacion,
          response: { 200: respuestaListadoDeUsuarios },
        },
        preHandler: permiso('seguridad.usuario.ver'),
      },
      (request) => listarUsuarios(pool, request.query),
    );

    app.post(
      '/usuarios',
      {
        schema: {
          tags: ['seguridad'],
          body: cuerpoDeNuevoUsuario,
          response: { 201: respuestaDeUsuarioCreado },
        },
        preHandler: permiso('seguridad.usuario.crear'),
      },
      async (request, reply) => {
        const usuario = await crearUsuario(servicios, usuarioDe(request), {
          etiqueta: request.body.etiqueta,
          rolIds: request.body.rol_ids,
        });
        return reply.status(201).header('location', `/api/v1/usuarios/${usuario.id}`).send(usuario);
      },
    );

    app.patch(
      '/usuarios/:id',
      {
        schema: {
          tags: ['seguridad'],
          params: parametrosDeUsuario,
          body: cuerpoDeEdicionDeUsuario,
          response: { 200: esquemaUsuario },
        },
        preHandler: permiso('seguridad.usuario.editar'),
      },
      (request) =>
        editarUsuario(pool, usuarioDe(request), request.params.id, {
          ...(request.body.etiqueta === undefined ? {} : { etiqueta: request.body.etiqueta }),
          ...(request.body.rol_ids === undefined ? {} : { rolIds: request.body.rol_ids }),
        }),
    );

    app.delete(
      '/usuarios/:id',
      {
        schema: { tags: ['seguridad'], params: parametrosDeUsuario },
        preHandler: permiso('seguridad.usuario.eliminar'),
      },
      async (request, reply) => {
        await eliminarUsuario(pool, usuarioDe(request), request.params.id);
        return reply.status(204).send();
      },
    );

    // Regenerar el PIN es editar al usuario: el anterior deja de servir (ADR 0018 §2).
    app.post(
      '/usuarios/:id/pin',
      {
        schema: {
          tags: ['seguridad'],
          params: parametrosDeUsuario,
          response: { 200: respuestaDePinGenerado },
        },
        preHandler: permiso('seguridad.usuario.editar'),
      },
      (request) => generarPin(servicios, usuarioDe(request), request.params.id),
    );
    listo();
  };
}
