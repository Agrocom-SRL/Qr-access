import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { esquemaPaginacion } from '../../platform/http/paginacion.js';
import { permiso, usuarioDe } from '../../plugins/permisos.js';
import { ejecutar as cerrarSesion } from './actions/cerrar-sesion.js';
import { ejecutar as compartirPin } from './actions/compartir-pin.js';
import { ejecutar as crearUsuario } from './actions/crear-usuario.js';
import { ejecutar as editarMiPerfil } from './actions/editar-mi-perfil.js';
import { ejecutar as editarUsuario } from './actions/editar-usuario.js';
import { ejecutar as eliminarUsuario } from './actions/eliminar-usuario.js';
import { ejecutar as generarPin } from './actions/generar-pin.js';
import { ejecutar as iniciarSesion } from './actions/iniciar-sesion.js';
import { ejecutar as listarRoles } from './actions/listar-roles.js';
import { ejecutar as listarUsuarios } from './actions/listar-usuarios.js';
import { ejecutar as refrescarSesion } from './actions/refrescar-sesion.js';
import { ejecutar as estadisticasDeUsuarios } from './actions/estadisticas-de-usuarios.js';
import { ejecutar as verCupo } from './actions/ver-cupo.js';
import { ejecutar as verSesionActual } from './actions/ver-sesion-actual.js';
import {
  cuerpoDeEdicionDeUsuario,
  cuerpoDeIngreso,
  cuerpoDeMiPerfil,
  cuerpoDeNuevoUsuario,
  consultaDeBaja,
  cuerpoDeRegeneracionDePin,
  cuerpoDeRefresco,
  esquemaUsuario,
  parametrosDeUsuario,
  respuestaDeCupo,
  respuestaDeEstadisticasDeUsuarios,
  respuestaDeIngreso,
  respuestaDePinGenerado,
  respuestaDeRefresco,
  respuestaDeSesionActual,
  respuestaDeMiPerfil,
  respuestaDeUsuarioCreado,
  respuestaListadoDeRoles,
  respuestaListadoDeUsuarios,
} from './schemas.js';
import { rutasDeCuentas } from './rutas-cuentas.js';
import { rutasDeEstructura } from './rutas-estructura.js';
import { rutasDePlataforma } from './rutas-plataforma.js';
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
        config: { acceso: 'publica', limite: 'login' },
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
        config: { acceso: 'publica', limite: 'refresco' },
      },
      (request) => refrescarSesion(servicios, request.body.refresco),
    );

    app.get(
      '/sesiones/actual',
      { schema: { tags: ['seguridad'], response: { 200: respuestaDeSesionActual } } },
      (request) => verSesionActual(pool, usuarioDe(request)),
    );

    // Cada persona edita su propio nombre; el PIN y los roles son del administrador de la cuenta.
    app.patch(
      '/perfil',
      {
        schema: {
          tags: ['seguridad'],
          body: cuerpoDeMiPerfil,
          response: { 200: respuestaDeMiPerfil },
        },
      },
      (request) => editarMiPerfil(pool, usuarioDe(request), request.body.etiqueta),
    );

    app.delete('/sesiones/actual', { schema: { tags: ['seguridad'] } }, async (request, reply) => {
      await cerrarSesion(servicios, usuarioDe(request));
      return reply.status(204).send();
    });

    // El porcentaje y los avisos del cupo los ve solo el Administrador (ADR 0028 §6).
    app.get(
      '/cupo',
      {
        schema: { tags: ['seguridad'], response: { 200: respuestaDeCupo } },
        preHandler: permiso('seguridad.cupo.ver'),
      },
      (request) => verCupo(pool, usuarioDe(request)),
    );

    // El uso de la rama del actor: inactivos, ruidosos y Titulares cerca de su tope (ADR 0028 §4).
    app.get(
      '/usuarios/estadisticas',
      {
        schema: { tags: ['seguridad'], response: { 200: respuestaDeEstadisticasDeUsuarios } },
        preHandler: permiso('seguridad.estadistica.ver'),
      },
      (request) => estadisticasDeUsuarios(pool, usuarioDe(request)),
    );

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
      (request) => listarUsuarios(pool, usuarioDe(request), request.query),
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
          ...(request.body.sufijo === undefined ? {} : { sufijo: request.body.sufijo }),
          ...(request.body.unidad === undefined
            ? {}
            : {
                unidad: {
                  sitioId: request.body.unidad.sitio_id,
                  nombre: request.body.unidad.nombre,
                },
              }),
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
        editarUsuario(pool, usuarioDe(request), request.params.id, request.body.etiqueta),
    );

    app.delete(
      '/usuarios/:id',
      {
        schema: { tags: ['seguridad'], params: parametrosDeUsuario, querystring: consultaDeBaja },
        preHandler: permiso('seguridad.usuario.eliminar'),
      },
      async (request, reply) => {
        await eliminarUsuario(pool, usuarioDe(request), request.params.id, request.query.confirmar);
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
          body: cuerpoDeRegeneracionDePin.nullish(),
          response: { 200: respuestaDePinGenerado },
        },
        preHandler: permiso('seguridad.usuario.editar'),
      },
      (request) =>
        generarPin(
          servicios,
          usuarioDe(request),
          request.params.id,
          new Date(),
          request.body?.sufijo,
        ),
    );
    // Anota que el PIN se compartió por un canal de terceros: solo el nivel superior, y queda en la bitácora.
    app.post(
      '/usuarios/:id/pin/compartido',
      {
        schema: { tags: ['seguridad'], params: parametrosDeUsuario },
        preHandler: permiso('seguridad.usuario.editar'),
      },
      async (request, reply) => {
        await compartirPin(pool, usuarioDe(request), request.params.id);
        return reply.status(204).send();
      },
    );
    app.register(rutasDePlataforma(servicios));
    app.register(rutasDeCuentas(servicios));
    app.register(rutasDeEstructura(servicios));
    listo();
  };
}
