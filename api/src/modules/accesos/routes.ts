import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import type { z } from 'zod';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { esquemaPaginacion } from '../../platform/http/paginacion.js';
import { dispositivoDe, permiso, usuarioDe } from '../../plugins/permisos.js';
import { ejecutar as anularQr } from './actions/anular-qr.js';
import { ejecutar as emitirQr } from './actions/emitir-qr.js';
import { ejecutar as listarEventos } from './actions/listar-eventos.js';
import { ejecutar as listarQr } from './actions/listar-qr.js';
import { ejecutar as resumirEventos } from './actions/resumir-eventos.js';
import { ejecutar as resumirQr } from './actions/resumir-qr.js';
import { ejecutar as validarQr } from './actions/validar-qr.js';
import type { EstadoDeQr } from './domain/estado-qr.js';
import {
  consultaDeEventos,
  consultaDeQr,
  cuerpoDeEmision,
  cuerpoDeValidacion,
  esquemaQr,
  parametrosDeQr,
  respuestaDeEmision,
  respuestaDeResumenDeEventos,
  respuestaDeResumenDeQr,
  respuestaDeValidacion,
  respuestaListadoDeEventos,
  respuestaListadoDeQr,
} from './schemas.js';

type ConsultaDeEventos = z.infer<typeof consultaDeEventos>;

/** Los filtros de la query, con `null` donde no se pidió nada. */
function filtrosDe(consulta: ConsultaDeEventos) {
  return {
    resultado: consulta.resultado ?? null,
    puertaId: consulta.puerta_id ?? null,
    desde: consulta.desde ?? null,
    hasta: consulta.hasta ?? null,
  };
}

/** Hora del reloj del dispositivo, solo si es una fecha creíble (puede venir sin NTP). */
function leerHoraDelDispositivo(texto: string | undefined): Date | null {
  if (texto === undefined) return null;
  const fecha = new Date(texto);
  const anio = fecha.getUTCFullYear();
  return Number.isNaN(fecha.getTime()) || anio < 2020 || anio > 2100 ? null : fecha;
}

export function rutas({ pool }: DependenciasDeModulo): FastifyPluginCallbackZod {
  return (app, _opciones, listo) => {
    app.post(
      '/qr-accesos',
      {
        schema: { tags: ['accesos'], body: cuerpoDeEmision, response: { 201: respuestaDeEmision } },
        preHandler: permiso('accesos.qr.emitir'),
      },
      async (request, reply) => {
        const qr = await emitirQr(pool, usuarioDe(request), {
          puertaIds: request.body.puerta_ids,
          venceAt: request.body.vence_at ?? null,
          etiqueta: request.body.etiqueta ?? null,
        });
        return reply.status(201).send(qr);
      },
    );

    app.get(
      '/qr-accesos',
      {
        schema: {
          tags: ['accesos'],
          querystring: esquemaPaginacion.extend(consultaDeQr.shape),
          response: { 200: respuestaListadoDeQr },
        },
        preHandler: permiso('accesos.qr.ver'),
      },
      (request) => {
        const { estado, ...paginacion } = request.query;
        return listarQr(pool, usuarioDe(request), {
          estado: (estado ?? null) as EstadoDeQr | null,
          paginacion,
        });
      },
    );

    app.get(
      '/qr-accesos/resumen',
      {
        schema: { tags: ['accesos'], response: { 200: respuestaDeResumenDeQr } },
        preHandler: permiso('accesos.qr.ver'),
      },
      (request) => resumirQr(pool, usuarioDe(request)),
    );

    app.post(
      '/qr-accesos/:id/anulacion',
      {
        schema: { tags: ['accesos'], params: parametrosDeQr, response: { 200: esquemaQr } },
        preHandler: permiso('accesos.qr.anular'),
      },
      (request) => anularQr(pool, usuarioDe(request), request.params.id),
    );

    app.get(
      '/eventos-acceso',
      {
        schema: {
          tags: ['accesos'],
          querystring: esquemaPaginacion.extend(consultaDeEventos.shape),
          response: { 200: respuestaListadoDeEventos },
        },
        preHandler: permiso('accesos.evento.ver'),
      },
      (request) => {
        const { pagina, por_pagina, ...filtros } = request.query;
        return listarEventos(pool, usuarioDe(request), filtrosDe(filtros), { pagina, por_pagina });
      },
    );

    app.get(
      '/eventos-acceso/resumen',
      {
        schema: {
          tags: ['accesos'],
          querystring: consultaDeEventos,
          response: { 200: respuestaDeResumenDeEventos },
        },
        preHandler: permiso('accesos.evento.ver'),
      },
      (request) => resumirEventos(pool, usuarioDe(request), filtrosDe(request.query)),
    );

    // Siempre 200 con `abrir` explícito: un rechazo de negocio no es un error HTTP para el firmware (ADR 0005).
    app.post(
      '/dispositivos/validaciones',
      {
        schema: {
          tags: ['dispositivos'],
          body: cuerpoDeValidacion,
          response: { 200: respuestaDeValidacion },
        },
        config: { acceso: 'dispositivo' },
      },
      (request) =>
        validarQr(pool, dispositivoDe(request), {
          texto: request.body.token,
          leidoEn: leerHoraDelDispositivo(request.body.leido_en),
        }),
    );
    listo();
  };
}
