import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { permisoDePlataforma, plataformaDe } from '../../plugins/permisos.js';
import { ejecutar as codigoDisponible } from './actions/codigo-disponible.js';
import { ejecutar as crearCuenta } from './actions/crear-cuenta.js';
import { ejecutar as listarCuentas } from './actions/listar-cuentas.js';
import { ejecutar as verCobranza } from './actions/ver-cobranza.js';
import { ejecutar as verCuenta } from './actions/ver-cuenta.js';
import { ejecutar as verSuscripcionDeCuenta } from './actions/ver-suscripcion-de-cuenta.js';
import { ejecutar as verPuertasDeCuenta } from './actions/ver-puertas-de-cuenta.js';
import {
  consultaDeCobranza,
  consultaDeCodigoDeCuenta,
  consultaDeCuentas,
  cuerpoDeNuevaCuenta,
  parametrosDeCuenta,
  respuestaDeCobranza,
  respuestaDeCodigoDeCuenta,
  respuestaDeSuscripcionDeCuenta,
  respuestaDeCuentaCreada,
  respuestaDeCuentas,
  respuestaDeDetalleDeCuenta,
  respuestaDePuertasDeCuenta,
} from './schemas.js';
import type { ServiciosDeSeguridad } from './servicios.js';

const ETIQUETA = ['plataforma'];

/** Las cuentas cliente vistas por el super admin (HU-01, HU-17): listado, alta y ficha. */
export const rutasDeCuentas =
  (servicios: ServiciosDeSeguridad): FastifyPluginCallbackZod =>
  (app, _opciones, listo) => {
    const { pool } = servicios;
    const plataforma = { acceso: 'plataforma' } as const;

    app.get(
      '/plataforma/cuentas',
      {
        schema: {
          tags: ETIQUETA,
          querystring: consultaDeCuentas,
          response: { 200: respuestaDeCuentas },
        },
        config: plataforma,
        preHandler: permisoDePlataforma('seguridad.cuenta.ver'),
      },
      (request) => {
        const { busqueda, estado, ...paginacion } = request.query;
        return listarCuentas(pool, { busqueda, estado }, paginacion);
      },
    );

    // Antes de `/:id`: "codigo-disponible" no es un id.
    app.get(
      '/plataforma/cuentas/codigo-disponible',
      {
        schema: {
          tags: ETIQUETA,
          querystring: consultaDeCodigoDeCuenta,
          response: { 200: respuestaDeCodigoDeCuenta },
        },
        config: plataforma,
        preHandler: permisoDePlataforma('seguridad.cuenta.crear'),
      },
      (request) =>
        codigoDisponible(pool, {
          codigo: request.query.codigo,
          razonSocial: request.query.razon_social,
        }),
    );

    app.post(
      '/plataforma/cuentas',
      {
        schema: {
          tags: ETIQUETA,
          body: cuerpoDeNuevaCuenta,
          response: { 201: respuestaDeCuentaCreada },
        },
        config: plataforma,
        preHandler: permisoDePlataforma('seguridad.cuenta.crear'),
      },
      async (request, reply) => {
        const cuerpo = request.body;
        const creada = await crearCuenta(servicios, plataformaDe(request), {
          razonSocial: cuerpo.razon_social,
          codigo: cuerpo.codigo,
          nit: cuerpo.nit,
          ciudad: cuerpo.ciudad,
          contactoNombre: cuerpo.contacto_nombre,
          contactoTelefono: cuerpo.contacto_telefono,
          planId: cuerpo.plan_id,
          inicio: cuerpo.inicio,
          administradorNombre: cuerpo.administrador_nombre,
        });
        return reply
          .status(201)
          .header('location', `/api/v1/plataforma/cuentas/${creada.cuenta.id}`)
          .send(creada);
      },
    );

    app.get(
      '/plataforma/cuentas/:id',
      {
        schema: {
          tags: ETIQUETA,
          params: parametrosDeCuenta,
          response: { 200: respuestaDeDetalleDeCuenta },
        },
        config: plataforma,
        preHandler: permisoDePlataforma('seguridad.cuenta.ver'),
      },
      (request) => verCuenta(pool, plataformaDe(request), request.params.id),
    );

    app.get(
      '/plataforma/cuentas/:id/puertas',
      {
        schema: {
          tags: ETIQUETA,
          params: parametrosDeCuenta,
          response: { 200: respuestaDePuertasDeCuenta },
        },
        config: plataforma,
        preHandler: permisoDePlataforma('seguridad.cuenta.ver'),
      },
      async (request) => ({
        datos: await verPuertasDeCuenta(pool, plataformaDe(request), request.params.id),
      }),
    );

    app.get(
      '/plataforma/cuentas/:id/suscripcion',
      {
        schema: {
          tags: ETIQUETA,
          params: parametrosDeCuenta,
          response: { 200: respuestaDeSuscripcionDeCuenta },
        },
        config: plataforma,
        preHandler: permisoDePlataforma('seguridad.cuenta.ver'),
      },
      (request) => verSuscripcionDeCuenta(pool, plataformaDe(request), request.params.id),
    );

    app.get(
      '/plataforma/cobranza',
      {
        schema: {
          tags: ETIQUETA,
          querystring: consultaDeCobranza,
          response: { 200: respuestaDeCobranza },
        },
        config: plataforma,
        preHandler: permisoDePlataforma('suscripciones.cobranza.ver'),
      },
      (request) => verCobranza(pool, request.query),
    );

    listo();
  };
