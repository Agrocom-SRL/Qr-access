import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { ContextoCuenta } from '../../platform/contexto/contexto-cuenta.js';
import { ErrorDeDominio } from '../../platform/errores/error-de-dominio.js';
import { permisoDePlataforma, plataformaDe } from '../../plugins/permisos.js';
import { crearServicioDeOrganizacion } from '../organizacion/contracts.js';
import {
  cuerpoDeEdicionDePuerta,
  cuerpoDeEdicionDeSitio,
  cuerpoDeNuevaPuerta,
  cuerpoDeNuevoSitio,
  parametrosDeCuenta,
  parametrosDePuerta,
  parametrosDeSitio,
  respuestaDeCreado,
  respuestaDeEstructuraDeCuenta,
} from './schemas.js';
import { RepositorioDeCuentasDePlataforma } from './repository.js';
import type { ServiciosDeSeguridad } from './servicios.js';

const ETIQUETA = ['plataforma'];

/**
 * Sitios y puertas de una cuenta, gestionados por AGROCOM (HU-07, HU-08): se registran desde el
 * panel y luego el ESP32 se vincula a la puerta. Cada llamada entra al contexto de la cuenta
 * pedida (ADR 0004 §7); una cuenta inexistente es 404.
 */
export const rutasDeEstructura =
  ({ pool }: ServiciosDeSeguridad): FastifyPluginCallbackZod =>
  (app, _opciones, listo) => {
    const plataforma = { acceso: 'plataforma' } as const;
    const organizacion = crearServicioDeOrganizacion(pool);

    /** Corre `fn` dentro de la cuenta `cuentaId` (o 404 si no existe). */
    const enLaCuenta = async <T>(
      request: Parameters<typeof plataformaDe>[0],
      cuentaId: string,
      fn: () => Promise<T>,
    ): Promise<T> => {
      const cuenta = await new RepositorioDeCuentasDePlataforma(pool).buscarPorId(cuentaId);
      if (cuenta === null) throw new ErrorDeDominio('cuenta.no_encontrada', 404);
      return ContextoCuenta.comoPlataformaEn(cuenta.id, plataformaDe(request).usuarioId, fn);
    };

    app.get(
      '/plataforma/cuentas/:id/sitios',
      {
        schema: {
          tags: ETIQUETA,
          params: parametrosDeCuenta,
          response: { 200: respuestaDeEstructuraDeCuenta },
        },
        config: plataforma,
        preHandler: permisoDePlataforma('seguridad.cuenta.ver'),
      },
      async (request) => ({
        datos: await enLaCuenta(request, request.params.id, () =>
          organizacion.verEstructura(new Date()),
        ),
      }),
    );

    app.post(
      '/plataforma/cuentas/:id/sitios',
      {
        schema: {
          tags: ETIQUETA,
          params: parametrosDeCuenta,
          body: cuerpoDeNuevoSitio,
          response: { 201: respuestaDeCreado },
        },
        config: plataforma,
        preHandler: permisoDePlataforma('organizacion.sitio.gestionar'),
      },
      async (request, reply) => {
        const sitio = await enLaCuenta(request, request.params.id, () =>
          organizacion.crearSitio({
            nombre: request.body.nombre,
            direccion: request.body.direccion,
            zonaHoraria: request.body.zona_horaria,
          }),
        );
        return reply.status(201).send(sitio);
      },
    );

    app.patch(
      '/plataforma/cuentas/:id/sitios/:sitioId',
      {
        schema: { tags: ETIQUETA, params: parametrosDeSitio, body: cuerpoDeEdicionDeSitio },
        config: plataforma,
        preHandler: permisoDePlataforma('organizacion.sitio.gestionar'),
      },
      async (request, reply) => {
        const cuerpo = request.body;
        await enLaCuenta(request, request.params.id, () =>
          organizacion.editarSitio(request.params.sitioId, {
            ...(cuerpo.nombre === undefined ? {} : { nombre: cuerpo.nombre }),
            ...(cuerpo.direccion === undefined ? {} : { direccion: cuerpo.direccion }),
            ...(cuerpo.zona_horaria === undefined ? {} : { zonaHoraria: cuerpo.zona_horaria }),
            ...(cuerpo.activo === undefined ? {} : { activo: cuerpo.activo }),
          }),
        );
        return reply.status(204).send();
      },
    );

    app.delete(
      '/plataforma/cuentas/:id/sitios/:sitioId',
      {
        schema: { tags: ETIQUETA, params: parametrosDeSitio },
        config: plataforma,
        preHandler: permisoDePlataforma('organizacion.sitio.gestionar'),
      },
      async (request, reply) => {
        await enLaCuenta(request, request.params.id, () =>
          organizacion.eliminarSitio(request.params.sitioId),
        );
        return reply.status(204).send();
      },
    );

    app.post(
      '/plataforma/cuentas/:id/sitios/:sitioId/puertas',
      {
        schema: {
          tags: ETIQUETA,
          params: parametrosDeSitio,
          body: cuerpoDeNuevaPuerta,
          response: { 201: respuestaDeCreado },
        },
        config: plataforma,
        preHandler: permisoDePlataforma('organizacion.puerta.gestionar'),
      },
      async (request, reply) => {
        const puerta = await enLaCuenta(request, request.params.id, () =>
          organizacion.crearPuerta(request.params.sitioId, {
            nombre: request.body.nombre,
            segundosApertura: request.body.segundos_apertura,
          }),
        );
        return reply.status(201).send(puerta);
      },
    );

    app.patch(
      '/plataforma/cuentas/:id/puertas/:puertaId',
      {
        schema: { tags: ETIQUETA, params: parametrosDePuerta, body: cuerpoDeEdicionDePuerta },
        config: plataforma,
        preHandler: permisoDePlataforma('organizacion.puerta.gestionar'),
      },
      async (request, reply) => {
        const cuerpo = request.body;
        await enLaCuenta(request, request.params.id, () =>
          organizacion.editarPuerta(request.params.puertaId, {
            ...(cuerpo.nombre === undefined ? {} : { nombre: cuerpo.nombre }),
            ...(cuerpo.segundos_apertura === undefined
              ? {}
              : { segundosApertura: cuerpo.segundos_apertura }),
            ...(cuerpo.activa === undefined ? {} : { activa: cuerpo.activa }),
          }),
        );
        return reply.status(204).send();
      },
    );

    app.delete(
      '/plataforma/cuentas/:id/puertas/:puertaId',
      {
        schema: { tags: ETIQUETA, params: parametrosDePuerta },
        config: plataforma,
        preHandler: permisoDePlataforma('organizacion.puerta.gestionar'),
      },
      async (request, reply) => {
        await enLaCuenta(request, request.params.id, () =>
          organizacion.eliminarPuerta(request.params.puertaId),
        );
        return reply.status(204).send();
      },
    );

    listo();
  };
