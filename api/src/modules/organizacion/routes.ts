import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { esquemaPaginacion } from '../../platform/http/paginacion.js';
import { permiso, tienePermiso, usuarioDe } from '../../plugins/permisos.js';
import { ejecutar as configurarAperturaManual } from './actions/configurar-apertura-manual.js';
import { ejecutar as listarAperturaManual } from './actions/listar-apertura-manual.js';
import { ejecutar as listarPuertas } from './actions/listar-puertas.js';
import { crearServicioDeOrganizacion } from './contracts.js';
import {
  cuerpoDeAperturaManual,
  cuerpoDeEdicionDePuerta,
  cuerpoDeEdicionDeSitio,
  cuerpoDeNuevaPuerta,
  cuerpoDeNuevoSitio,
  esquemaListadoDePuertas,
  esquemaPuertasAsignadas,
  parametrosDeUsuario,
  parametrosDePuerta,
  parametrosDeSitio,
  respuestaDeAperturaManual,
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

    // `/puertas/apertura-manual` no choca con `/puertas/:puertaId` (ese solo atiende PATCH y DELETE).
    app.get(
      '/puertas/apertura-manual',
      {
        schema: {
          tags: ETIQUETA,
          description:
            'Las puertas de la cuenta con su apertura manual (ADR 0035 §5). Con el permiso ' +
            '`accesos.apertura_manual.configurar` salen todas las activas, con `tiene_placa` (la pantalla del ' +
            'administrador muestra «Sin placa» sin interruptor); con solo `accesos.apertura_manual.usar`, ' +
            'únicamente las `disponible` (encendidas y con al menos una placa en servicio), que son las que la app ' +
            'ofrece en el botón de abrir. Ningún campo lleva sentido.',
          response: { 200: respuestaDeAperturaManual },
        },
        // Cualquiera de los dos permisos sirve: quien configura también necesita ver las puertas.
        preHandler: (request) => {
          const usuario = usuarioDe(request);
          return tienePermiso(usuario, 'accesos.apertura_manual.configurar')
            ? Promise.resolve()
            : permiso('accesos.apertura_manual.usar')(request);
        },
      },
      async (request) => ({
        datos: await listarAperturaManual(
          pool,
          { verTodas: tienePermiso(usuarioDe(request), 'accesos.apertura_manual.configurar') },
          new Date(),
        ),
      }),
    );

    app.put(
      '/puertas/:puertaId/apertura-manual',
      {
        schema: {
          tags: ETIQUETA,
          description:
            'Enciende o apaga la apertura manual de una puerta (solo el Administrador de la cuenta). 404 ' +
            '`puerta.no_encontrada` si no es de la cuenta. Se puede escribir aunque la puerta no tenga placa.',
          params: parametrosDePuerta,
          body: cuerpoDeAperturaManual,
        },
        preHandler: permiso('accesos.apertura_manual.configurar'),
      },
      async (request, reply) => {
        await configurarAperturaManual(
          pool,
          { tipo: 'puerta', puertaId: request.params.puertaId },
          request.body.habilitada,
        );
        return reply.status(204).send();
      },
    );

    // La cuenta propia se nombra `actual` (no hay una ruta de la cuenta propia todavía; la plataforma usa
    // `/plataforma/cuentas/{id}`): el id sale siempre del contexto de la sesión, nunca de la petición.
    app.put(
      '/cuentas/actual/apertura-manual',
      {
        schema: {
          tags: ETIQUETA,
          description:
            'Enciende o apaga la apertura manual en TODAS las puertas de la cuenta y el valor inicial de las ' +
            'puertas que se registren después (ADR 0035 §5), en una sola transacción. Solo el Administrador.',
          body: cuerpoDeAperturaManual,
        },
        preHandler: permiso('accesos.apertura_manual.configurar'),
      },
      async (request, reply) => {
        await configurarAperturaManual(pool, { tipo: 'cuenta' }, request.body.habilitada);
        return reply.status(204).send();
      },
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
