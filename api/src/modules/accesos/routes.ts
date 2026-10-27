import type { FastifyInstance } from 'fastify';
import type { Pool } from 'mysql2/promise';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import type { z } from 'zod';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { esquemaPaginacion } from '../../platform/http/paginacion.js';
import { presupuestoDePeticion } from '../../platform/http/presupuesto.js';
import { dispositivoDe, permiso, usuarioDe } from '../../plugins/permisos.js';
import { ejecutar as anularQr } from './actions/anular-qr.js';
import { ejecutar as consultarEstadoQr } from './actions/consultar-estado-qr.js';
import { ejecutar as generarQr } from './actions/generar-qr.js';
import { ejecutar as limpiarClavesVencidas } from './actions/limpiar-claves-vencidas.js';
import { ejecutar as listarEventos } from './actions/listar-eventos.js';
import { ejecutar as listarQr } from './actions/listar-qr.js';
import { ejecutar as resumirEventos } from './actions/resumir-eventos.js';
import { ejecutar as resumirQr } from './actions/resumir-qr.js';
import { ejecutar as validarQr } from './actions/validar-qr.js';
import type { EstadoDeQr } from './domain/estado-qr.js';
import {
  consultaDeEventos,
  consultaDeQr,
  cuerpoDeGeneracion,
  cuerpoDeValidacion,
  cabecerasDeGeneracion,
  esquemaQr,
  parametrosDeQr,
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

/** Cada cuánto se barren las claves de idempotencia vencidas (el resto lo limpia cada escritura). */
const CADA_CUANTO_LIMPIAR_MS = 60 * 60 * 1000;

/**
 * Barre cada hora las claves de idempotencia vencidas de todas las cuentas. En tests no corre (los tests llaman
 * a la acción). El temporizador no mantiene vivo el proceso y se detiene al cerrar la app.
 */
function programarLimpiezaDeClaves(app: FastifyInstance, pool: Pool): void {
  if (process.env.NODE_ENV === 'test') return;
  const temporizador = setInterval(() => {
    limpiarClavesVencidas(pool).catch((falla: unknown) => {
      app.log.warn(
        { evento: 'idempotencia.limpieza_fallida', codigo: (falla as { code?: string }).code },
        'no se pudieron limpiar las claves de idempotencia vencidas',
      );
    });
  }, CADA_CUANTO_LIMPIAR_MS);
  temporizador.unref();
  app.addHook('onClose', () => {
    clearInterval(temporizador);
  });
}

export function rutas({
  pool,
  poolDispositivos,
  config,
}: DependenciasDeModulo): FastifyPluginCallbackZod {
  return (app, _opciones, listo) => {
    programarLimpiezaDeClaves(app, pool);
    app.post(
      '/qr-accesos',
      {
        schema: {
          tags: ['accesos'],
          description:
            'Genera un QR de un solo uso. 201 con el QR nuevo y su `texto`. 200 con `reutilizado: true` cuando ' +
            'el QR propio (`propio: true`) sigue vigente y sin usar para las mismas puertas: no se crea nada y ' +
            '`texto` es `null` (el servidor solo guarda el hash; la app conserva el token). Se ignoran ' +
            '`vence_at` y `etiqueta` al reutilizar, salvo `reemplazar: true`. 429 con `qr.limite_*` al superar un tope. ' +
            'Cabecera opcional `Idempotency-Key` (ADR 0031 §11): un reintento con la misma clave y el mismo cuerpo ' +
            'devuelve la misma respuesta (mismo `texto`), con la cabecera `Idempotent-Replayed: true`, sin generar ' +
            'otro QR ni gastar topes; la misma clave con otro cuerpo responde 422 `idempotencia.conflicto`; dos ' +
            'peticiones simultáneas con la misma clave pueden recibir 409 `idempotencia.en_curso` (reintentar). ' +
            'Si el QR de la clave ya se usó, se anuló, se reemplazó o venció, el reintento responde 409 ' +
            '`idempotencia.qr_no_vigente`. La clave es por usuario, dura 24 h y debe ser un UUID o un base64url de ' +
            '22 a 128 caracteres: otra cosa es 400 `validacion.invalida`.',
          headers: cabecerasDeGeneracion,
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
          ...(request.headers['idempotency-key'] === undefined
            ? {}
            : {
                idempotencia: {
                  clave: request.headers['idempotency-key'],
                  secreto: config.QR_IDEMPOTENCIA_CLAVE,
                },
              }),
        });
        if (qr.repetido === true) void reply.header('Idempotent-Replayed', 'true');
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
    listo();
  };
}
