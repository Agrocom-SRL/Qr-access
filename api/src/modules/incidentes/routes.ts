import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { permiso, permisoDePlataforma, plataformaDe, usuarioDe } from '../../plugins/permisos.js';
import { ejecutar as listarIncidentes } from './actions/listar-incidentes.js';
import { ejecutar as listarIncidentesDeCuenta } from './actions/listar-incidentes-de-cuenta.js';
import { ejecutar as registrarIncidente } from './actions/registrar-incidente.js';
import { ejecutar as resolverIncidente } from './actions/resolver-incidente.js';
import { ejecutar as verIncidente } from './actions/ver-incidente.js';
import { ejecutar as verPolitica } from './actions/ver-politica.js';
import {
  consultaDeIncidentes,
  cuerpoDeIncidente,
  cuerpoDeResolucion,
  esquemaIncidenteDetallado,
  parametrosDeCuentaDeIncidentes,
  parametrosDeIncidente,
  respuestaDePolitica,
  respuestaDeResolucionDeIncidente,
  respuestaListadoDeIncidentes,
} from './schemas.js';

const ETIQUETA = ['incidentes'];

/**
 * Incidentes de uso y reincidencia (ADR 0033 §3 y §4). El permiso dice qué puede hacer cada rol; sobre quién lo hace
 * lo dice el árbol de usuarios (ADR 0028), no la ruta.
 */
export function rutas({ pool }: DependenciasDeModulo): FastifyPluginCallbackZod {
  return (app, _opciones, listo) => {
    app.get(
      '/incidentes',
      {
        schema: {
          tags: ETIQUETA,
          description:
            'Incidentes de uso a la vista de quien pregunta: el Administrador ve los de la cuenta; el Titular, los de sus ' +
            'Miembros y los suyos; el Miembro y el Guardia, los propios. `estado` filtra por la última resolución (`sin_resolver` ' +
            'si no hay ninguna).',
          querystring: consultaDeIncidentes,
          response: { 200: respuestaListadoDeIncidentes },
        },
        preHandler: permiso('seguridad.incidente.ver'),
      },
      (request) => {
        const { pagina, por_pagina, usuario_id, tipo, origen, estado } = request.query;
        return listarIncidentes(
          pool,
          usuarioDe(request),
          {
            usuarioId: usuario_id ?? null,
            tipo: tipo ?? null,
            origen: origen ?? null,
            estado: estado ?? null,
          },
          { pagina, por_pagina },
        );
      },
    );

    // `/incidentes/politica` va antes de `/incidentes/:id`: el segmento fijo gana (y `:id` solo acepta dígitos).
    app.get(
      '/incidentes/politica',
      {
        schema: {
          tags: ETIQUETA,
          description:
            'La política de reincidencia que le aplica a la cuenta (ADR 0033 §4.5): cuántos incidentes CONFIRMADOS en ' +
            'cuántos días hay que juntar para que el sistema proponga un paso, y si la cuenta tiene encendida la ' +
            'restricción automática (nivel leve). La ajusta AGROCOM.',
          response: { 200: respuestaDePolitica },
        },
        preHandler: permiso('seguridad.incidente.ver'),
      },
      async () => {
        const politica = await verPolitica(pool);
        return {
          reincidencia_minimo: politica.reincidenciaMinimo,
          reincidencia_ventana_dias: politica.reincidenciaVentanaDias,
          restriccion_automatica: politica.restriccionAutomatica,
        };
      },
    );

    app.get(
      '/incidentes/:id',
      {
        schema: {
          tags: ETIQUETA,
          description:
            'Un incidente con su historial de resoluciones. 404 `incidente.no_encontrado` si no existe, es de otra cuenta o ' +
            'está fuera del alcance de quien pregunta.',
          params: parametrosDeIncidente,
          response: { 200: esquemaIncidenteDetallado },
        },
        preHandler: permiso('seguridad.incidente.ver'),
      },
      (request) => verIncidente(pool, usuarioDe(request), request.params.id),
    );

    app.post(
      '/incidentes',
      {
        schema: {
          tags: ETIQUETA,
          description:
            'Registra a mano un incidente de uso (origen `persona`) de alguien de la rama de quien lo registra. 404 ' +
            '`usuario.no_encontrado` fuera del alcance o de otra cuenta; 403 `incidente.propio` sobre uno mismo; 422 ' +
            '`incidente.evidencia_invalida` si un id de QR o de intento no existe en la cuenta; 422 ' +
            '`incidente.fecha_futura`. Nace sin resolver.',
          body: cuerpoDeIncidente,
          response: { 201: esquemaIncidenteDetallado },
        },
        preHandler: permiso('seguridad.incidente.resolver'),
      },
      async (request, reply) => {
        const cuerpo = request.body;
        const incidente = await registrarIncidente(pool, usuarioDe(request), {
          usuarioId: cuerpo.usuario_id,
          tipo: cuerpo.tipo,
          gravedad: cuerpo.gravedad,
          descripcion: cuerpo.descripcion ?? null,
          evidencia: cuerpo.evidencia,
          ocurridoAt: cuerpo.ocurrido_at ?? null,
        });
        return reply.status(201).send(incidente);
      },
    );

    app.post(
      '/incidentes/:id/resolucion',
      {
        schema: {
          tags: ETIQUETA,
          description:
            'Descarta, confirma o deja pendiente un incidente. Confirmar exige `motivo` (422 `incidente.motivo_requerido`). ' +
            'Al confirmar se evalúa la reincidencia: si se cruza el umbral el sistema PROPONE un paso (aviso en la bandeja ' +
            'de quienes administran la rama y de AGROCOM) y no aplica nada, salvo la restricción automática si la cuenta la ' +
            'encendió. 403 `incidente.propio` sobre un incidente propio; 404 `incidente.no_encontrado` fuera del alcance. ' +
            'Repetir el mismo resultado es inofensivo.',
          params: parametrosDeIncidente,
          body: cuerpoDeResolucion,
          response: { 200: respuestaDeResolucionDeIncidente },
        },
        preHandler: permiso('seguridad.incidente.resolver'),
      },
      async (request) => {
        const { incidente, reincidencia } = await resolverIncidente(
          pool,
          usuarioDe(request),
          request.params.id,
          { resultado: request.body.resultado, motivo: request.body.motivo ?? null },
        );
        return {
          incidente,
          reincidencia:
            reincidencia === null
              ? null
              : {
                  confirmados: reincidencia.confirmados,
                  minimo: reincidencia.minimo,
                  ventana_dias: reincidencia.ventanaDias,
                  propuesta: reincidencia.propuesta,
                  aplicada_automaticamente: reincidencia.aplicadaAutomaticamente,
                },
        };
      },
    );

    app.get(
      '/plataforma/cuentas/:cuenta_id/incidentes',
      {
        schema: {
          tags: ['plataforma'],
          description:
            'Los incidentes de uso de una cuenta, para AGROCOM (solo lectura). 404 `cuenta.no_encontrada` si no existe.',
          params: parametrosDeCuentaDeIncidentes,
          querystring: consultaDeIncidentes,
          response: { 200: respuestaListadoDeIncidentes },
        },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('seguridad.cuenta.ver'),
      },
      (request) => {
        const { pagina, por_pagina, usuario_id, tipo, origen, estado } = request.query;
        return listarIncidentesDeCuenta(
          pool,
          plataformaDe(request),
          request.params.cuenta_id,
          {
            usuarioId: usuario_id ?? null,
            tipo: tipo ?? null,
            origen: origen ?? null,
            estado: estado ?? null,
          },
          { pagina, por_pagina },
        );
      },
    );

    listo();
  };
}
