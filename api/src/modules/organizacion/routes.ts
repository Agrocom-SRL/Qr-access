import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { esquemaPaginacion } from '../../platform/http/paginacion.js';
import { permiso } from '../../plugins/permisos.js';
import { ejecutar as listarPuertas } from './actions/listar-puertas.js';
import { crearServicioDeOrganizacion } from './contracts.js';
import {
  cuerpoDeEdicionDePuerta,
  cuerpoDeEdicionDeSitio,
  cuerpoDeNuevaPuerta,
  cuerpoDeNuevoSitio,
  esquemaListadoDePuertas,
  esquemaPuertasAsignadas,
  parametrosDeUsuario,
  parametrosDePuerta,
  parametrosDeSitio,
  respuestaDeCreado,
  respuestaDeEstructura,
} from './schemas.js';

export function rutas({ pool }: DependenciasDeModulo): FastifyPluginCallbackZod {
  return (app, _opciones, listo) => {
    const organizacion = crearServicioDeOrganizacion(pool);
    const ETIQUETA = ['organizacion'];

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

    // Estructura de la cuenta del contexto: el administrador gestiona sus sitios y puertas (HU-07).
    // Vincular la placa a una puerta sigue siendo del super admin (ADR 0026).
    app.get(
      '/sitios',
      {
        schema: { tags: ETIQUETA, response: { 200: respuestaDeEstructura } },
        preHandler: permiso('organizacion.puerta.administrar'),
      },
      async () => ({ datos: await organizacion.verEstructura(new Date()) }),
    );

    app.post(
      '/sitios',
      {
        schema: { tags: ETIQUETA, body: cuerpoDeNuevoSitio, response: { 201: respuestaDeCreado } },
        preHandler: permiso('organizacion.sitio.administrar'),
      },
      async (request, reply) => {
        const sitio = await organizacion.crearSitio({
          nombre: request.body.nombre,
          direccion: request.body.direccion,
          zonaHoraria: request.body.zona_horaria,
        });
        return reply.status(201).send(sitio);
      },
    );

    app.patch(
      '/sitios/:sitioId',
      {
        schema: { tags: ETIQUETA, params: parametrosDeSitio, body: cuerpoDeEdicionDeSitio },
        preHandler: permiso('organizacion.sitio.administrar'),
      },
      async (request, reply) => {
        const cuerpo = request.body;
        await organizacion.editarSitio(request.params.sitioId, {
          ...(cuerpo.nombre === undefined ? {} : { nombre: cuerpo.nombre }),
          ...(cuerpo.direccion === undefined ? {} : { direccion: cuerpo.direccion }),
          ...(cuerpo.zona_horaria === undefined ? {} : { zonaHoraria: cuerpo.zona_horaria }),
          ...(cuerpo.activo === undefined ? {} : { activo: cuerpo.activo }),
        });
        return reply.status(204).send();
      },
    );

    app.delete(
      '/sitios/:sitioId',
      {
        schema: { tags: ETIQUETA, params: parametrosDeSitio },
        preHandler: permiso('organizacion.sitio.administrar'),
      },
      async (request, reply) => {
        await organizacion.eliminarSitio(request.params.sitioId);
        return reply.status(204).send();
      },
    );

    app.post(
      '/sitios/:sitioId/puertas',
      {
        schema: {
          tags: ETIQUETA,
          params: parametrosDeSitio,
          body: cuerpoDeNuevaPuerta,
          response: { 201: respuestaDeCreado },
        },
        preHandler: permiso('organizacion.puerta.administrar'),
      },
      async (request, reply) => {
        const puerta = await organizacion.crearPuerta(request.params.sitioId, {
          nombre: request.body.nombre,
          segundosApertura: request.body.segundos_apertura,
        });
        return reply.status(201).send(puerta);
      },
    );

    app.patch(
      '/puertas/:puertaId',
      {
        schema: { tags: ETIQUETA, params: parametrosDePuerta, body: cuerpoDeEdicionDePuerta },
        preHandler: permiso('organizacion.puerta.administrar'),
      },
      async (request, reply) => {
        const cuerpo = request.body;
        await organizacion.editarPuerta(request.params.puertaId, {
          ...(cuerpo.nombre === undefined ? {} : { nombre: cuerpo.nombre }),
          ...(cuerpo.segundos_apertura === undefined
            ? {}
            : { segundosApertura: cuerpo.segundos_apertura }),
          ...(cuerpo.activa === undefined ? {} : { activa: cuerpo.activa }),
        });
        return reply.status(204).send();
      },
    );

    app.delete(
      '/puertas/:puertaId',
      {
        schema: { tags: ETIQUETA, params: parametrosDePuerta },
        preHandler: permiso('organizacion.puerta.administrar'),
      },
      async (request, reply) => {
        await organizacion.eliminarPuerta(request.params.puertaId);
        return reply.status(204).send();
      },
    );

    // A qué puertas está asignado un usuario (guardia): de ellas ve los eventos y el estado.
    app.get(
      '/usuarios/:usuarioId/puertas-asignadas',
      {
        schema: {
          tags: ETIQUETA,
          params: parametrosDeUsuario,
          response: { 200: esquemaPuertasAsignadas },
        },
        preHandler: permiso('organizacion.guardia.asignar'),
      },
      async (request) => {
        const asignadas = await organizacion.puertasAsignadasA(request.params.usuarioId);
        return { todas: asignadas.todas, puerta_ids: [...asignadas.puertaIds] };
      },
    );

    app.put(
      '/usuarios/:usuarioId/puertas-asignadas',
      {
        schema: {
          tags: ETIQUETA,
          params: parametrosDeUsuario,
          body: esquemaPuertasAsignadas,
        },
        preHandler: permiso('organizacion.guardia.asignar'),
      },
      async (request, reply) => {
        await organizacion.asignarPuertas(request.params.usuarioId, {
          todas: request.body.todas,
          puertaIds: request.body.puerta_ids,
        });
        return reply.status(204).send();
      },
    );

    listo();
  };
}
