import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { ContextoCuenta } from '../../platform/contexto/contexto-cuenta.js';
import { permisoDePlataforma, plataformaDe } from '../../plugins/permisos.js';
import { ejecutar as actualizarPrecios } from './actions/actualizar-precios.js';
import { ejecutar as cambiarEstado } from './actions/cambiar-estado.js';
import { ejecutar as cambiarPlan } from './actions/cambiar-plan.js';
import { ejecutar as listarPlanes } from './actions/listar-planes.js';
import { ejecutar as registrarPago } from './actions/registrar-pago.js';
import {
  cuerpoDeCambioDePlan,
  cuerpoDePago,
  cuerpoDePrecios,
  parametrosDeCuenta,
  respuestaDeCambioDePlan,
  respuestaDePago,
  respuestaDePlanes,
} from './schemas.js';

const ETIQUETA = ['plataforma'];

/** Planes, suscripciones y cobranza de la plataforma (ADR 0017 y 0022); todo es del super admin. */
export function rutas({ pool }: DependenciasDeModulo): FastifyPluginCallbackZod {
  return (app, _opciones, listo) => {
    app.get(
      '/plataforma/planes',
      {
        schema: { tags: ETIQUETA, response: { 200: respuestaDePlanes } },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('suscripciones.plan.ver'),
      },
      async () => ({ datos: await listarPlanes(pool) }),
    );

    app.put(
      '/plataforma/planes/precios',
      {
        schema: { tags: ETIQUETA, body: cuerpoDePrecios },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('suscripciones.plan.editar'),
      },
      async (request, reply) => {
        await actualizarPrecios(
          pool,
          request.body.precios.map((p) => ({ planId: p.plan_id, precioAnual: p.precio_anual })),
        );
        return reply.status(204).send();
      },
    );

    // Todo lo que sigue opera DENTRO de la cuenta (ADR 0004 §7): el super admin firma cada cambio.
    const enLaCuenta = <T>(
      request: Parameters<typeof plataformaDe>[0],
      cuentaId: string,
      fn: () => Promise<T>,
    ) => ContextoCuenta.comoPlataformaEn(cuentaId, plataformaDe(request).usuarioId, fn);

    app.post(
      '/plataforma/cuentas/:id/pagos',
      {
        schema: {
          tags: ETIQUETA,
          params: parametrosDeCuenta,
          body: cuerpoDePago,
          response: { 201: respuestaDePago },
        },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('suscripciones.pago.registrar'),
      },
      async (request, reply) => {
        const pago = await enLaCuenta(request, request.params.id, () =>
          registrarPago(pool, {
            tipo: request.body.tipo,
            monto: request.body.monto,
            fechaPago: request.body.fecha_pago,
            medio: request.body.medio,
            referencia: request.body.referencia,
          }),
        );
        return reply.status(201).send(pago);
      },
    );

    app.put(
      '/plataforma/cuentas/:id/suscripcion/plan',
      {
        schema: {
          tags: ETIQUETA,
          params: parametrosDeCuenta,
          body: cuerpoDeCambioDePlan,
          response: { 200: respuestaDeCambioDePlan },
        },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('suscripciones.suscripcion.editar'),
      },
      (request) =>
        enLaCuenta(request, request.params.id, () => cambiarPlan(pool, request.body.plan_id)),
    );

    for (const [ruta, estado] of [
      ['suspension', 'suspendida'],
      ['reactivacion', 'vigente'],
    ] as const) {
      app.post(
        `/plataforma/cuentas/:id/suscripcion/${ruta}`,
        {
          schema: { tags: ETIQUETA, params: parametrosDeCuenta },
          config: { acceso: 'plataforma' },
          preHandler: permisoDePlataforma('suscripciones.suscripcion.editar'),
        },
        async (request, reply) => {
          await enLaCuenta(request, request.params.id, () => cambiarEstado(pool, estado));
          return reply.status(204).send();
        },
      );
    }

    listo();
  };
}
