import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import type { z } from 'zod';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { esquemaPaginacion } from '../../platform/http/paginacion.js';
import { presupuestoDePeticion } from '../../platform/http/presupuesto.js';
import { dispositivoDe, permiso, usuarioDe } from '../../plugins/permisos.js';
import { ejecutar as anularQr } from './actions/anular-qr.js';
import { ejecutar as confirmarApertura } from './actions/confirmar-apertura.js';
import { ejecutar as consultarEstadoQr } from './actions/consultar-estado-qr.js';
import { ejecutar as generarQr } from './actions/generar-qr.js';
import { ejecutar as listarEventos } from './actions/listar-eventos.js';
import { ejecutar as listarQr } from './actions/listar-qr.js';
import { ejecutar as resumirEventos } from './actions/resumir-eventos.js';
import { ejecutar as resumirQr } from './actions/resumir-qr.js';
import { ejecutar as validarQr } from './actions/validar-qr.js';
import { ejecutar as verEvento } from './actions/ver-evento.js';
import type { EstadoDeQr } from './domain/estado-qr.js';
import {
  consultaDeEventos,
  consultaDeQr,
  cuerpoDeConfirmacionDeApertura,
  cuerpoDeGeneracion,
  cuerpoDeValidacion,
  esquemaQr,
  parametrosDeEvento,
  parametrosDeQr,
  respuestaDeEventoDetallado,
  respuestaDeGeneracion,
  respuestaDeEstadoDeQr,
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
    ejecucion: consulta.ejecucion ?? null,
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

export function rutas({
  pool,
  poolDispositivos,
  config,
}: DependenciasDeModulo): FastifyPluginCallbackZod {
  return (app, _opciones, listo) => {
    app.post(
      '/qr-accesos',
      {
        schema: {
          tags: ['accesos'],
          description:
            'Genera un QR de un solo uso. 201 con el QR nuevo y su `texto`. 200 con `reutilizado: true` cuando ' +
            'el QR propio (`propio: true`) sigue vigente y sin usar para las mismas puertas: no se crea nada y ' +
            '`texto` es `null` (el servidor solo guarda el hash; la app conserva el token). Se ignoran ' +
            '`vence_at` y `etiqueta` al reutilizar, salvo `reemplazar: true`. 429 con `qr.limite_*` al superar un tope.',
          body: cuerpoDeGeneracion,
          response: { 200: respuestaDeGeneracion, 201: respuestaDeGeneracion },
        },
        // Ráfagas cortas por minuto, además de los topes diarios de la acción (ADR 0030 §3.2).
        config: { limite: 'generar_qr' },
        // El QR propio y el de visitas son permisos distintos: el Guardia solo tiene el primero (ADR 0028 §5).
        // El cuerpo ya está validado cuando corre el `preHandler`.
        preHandler: (request) =>
          permiso(
            request.body.propio === true ? 'accesos.qr.generar_propio' : 'accesos.qr.generar',
          )(request),
      },
      async (request, reply) => {
        const qr = await generarQr(pool, usuarioDe(request), {
          puertaIds: request.body.puerta_ids,
          venceAt: request.body.vence_at ?? null,
          etiqueta: request.body.etiqueta ?? null,
          propio: request.body.propio ?? false,
          reemplazar: request.body.reemplazar ?? false,
          log: request.log,
        });
        // Reutilizar el QR propio no crea nada: 200. Un QR nuevo: 201.
        return reply.status(qr.reutilizado ? 200 : 201).send(qr);
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

    app.get(
      '/qr-accesos/:id/estado',
      {
        schema: {
          tags: ['accesos'],
          params: parametrosDeQr,
          response: { 200: respuestaDeEstadoDeQr },
        },
        preHandler: permiso('accesos.qr.ver'),
      },
      (request) => consultarEstadoQr(pool, usuarioDe(request), request.params.id),
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

    // `/eventos-acceso/resumen` va antes: el segmento fijo gana a `:id`.
    app.get(
      '/eventos-acceso/:id',
      {
        schema: {
          tags: ['accesos'],
          description:
            'Un intento de acceso con el detalle de su ejecución (`confirmaciones`). 404 `evento.no_encontrado` si no existe, es de otra cuenta o está fuera del alcance del rol.',
          params: parametrosDeEvento,
          response: { 200: respuestaDeEventoDetallado },
        },
        preHandler: permiso('accesos.evento.ver'),
      },
      (request) => verEvento(pool, usuarioDe(request), request.params.id),
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
        // Pool reservado y tope de petición menor a la espera del firmware (ADR 0032 §1). El
        // límite es por credencial de dispositivo y holgado: nunca por usuario (ADR 0030 §1).
        config: { acceso: 'dispositivo', limite: 'validacion' },
        handlerTimeout: config.PETICION_MS_DISPOSITIVOS,
      },
      (request, reply) =>
        validarQr(
          poolDispositivos,
          dispositivoDe(request),
          { texto: request.body.token, leidoEn: leerHoraDelDispositivo(request.body.leido_en) },
          new Date(),
          // Plazo propio o desconexión real del cliente: sin COMMIT si la placa ya no espera.
          // Nunca `request.signal` (se aborta al leer el cuerpo en Node 22; ver presupuesto.ts).
          presupuestoDePeticion(reply, config.PETICION_MS_DISPOSITIVOS),
        ),
    );

    // La placa cuenta si la puerta se abrió tras `abrir: true` (ADR 0031 §18). Solo informa: no abre nada ni frena
    // la validación. Cuenta contra el límite de la credencial (clase `dispositivo`), no contra el de `validacion`.
    app.post(
      '/dispositivos/confirmaciones',
      {
        schema: {
          tags: ['dispositivos'],
          description:
            'La placa informa qué pasó con una apertura ordenada. 204 si se registró o si ya había un informe de esa apertura (idempotente). 404 `evento.no_encontrado` si el evento no es una apertura permitida de este dispositivo. 409 `confirmacion.fuera_de_plazo` pasados 10 minutos.',
          body: cuerpoDeConfirmacionDeApertura,
        },
        config: { acceso: 'dispositivo' },
        handlerTimeout: config.PETICION_MS_DISPOSITIVOS,
      },
      async (request, reply) => {
        const { evento_id: eventoId, leido_en: leidoEn } = request.body;
        await confirmarApertura(
          poolDispositivos,
          dispositivoDe(request),
          {
            eventoId,
            informe:
              request.body.resultado === 'fallida'
                ? { resultado: 'fallida', causa: request.body.causa }
                : { resultado: request.body.resultado },
            reportadoEn: leerHoraDelDispositivo(leidoEn),
          },
          new Date(),
          request.signal,
        );
        return reply.status(204).send();
      },
    );
    listo();
  };
}
