import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { AlmacenamientoEnDisco } from '../../platform/almacenamiento/disco.js';
import { TIPOS_DE_COMPROBANTE } from '../../platform/archivos/tipo-de-archivo.js';
import { ContextoCuenta } from '../../platform/contexto/contexto-cuenta.js';
import { permisoDePlataforma, plataformaDe } from '../../plugins/permisos.js';
import { ejecutar as actualizarPrecios } from './actions/actualizar-precios.js';
import * as gestionarCuentasDeCobro from './actions/gestionar-cuentas-de-cobro.js';
import * as gestionarPlanes from './actions/gestionar-planes.js';
import { ejecutar as cambiarEstado } from './actions/cambiar-estado.js';
import { ejecutar as cambiarPlan } from './actions/cambiar-plan.js';
import { ejecutar as listarPlanes } from './actions/listar-planes.js';
import { ejecutar as leerComprobante } from './actions/leer-comprobante.js';
import { ejecutar as registrarPago } from './actions/registrar-pago.js';
import {
  ejecutar as subirComprobante,
  MAX_BYTES_DE_COMPROBANTE,
} from './actions/subir-comprobante.js';
import {
  cuerpoDeCambioDePlan,
  cuerpoDeCuentaDeCobroNueva,
  cuerpoDeEdicionDeCuentaDeCobro,
  parametrosDeCuentaDeCobro,
  respuestaDeCuentasDeCobro,
  cuerpoDeEdicionDePlan,
  cuerpoDePlanNuevo,
  cuerpoDePago,
  cuerpoDePrecios,
  parametrosDeCuenta,
  parametrosDePlan,
  parametrosDeComprobante,
  respuestaDeCambioDePlan,
  respuestaDeComprobante,
  respuestaDePago,
  respuestaDePlanCreado,
  respuestaDePlanes,
  respuestaDePlanRetirado,
} from './schemas.js';

const ETIQUETA = ['plataforma'];

/** Planes, suscripciones y cobranza de la plataforma (ADR 0017 y 0022); todo es del super admin. */
export function rutas({ pool, config }: DependenciasDeModulo): FastifyPluginCallbackZod {
  const almacen = new AlmacenamientoEnDisco(config.ARCHIVOS_RUTA);
  return (app, _opciones, listo) => {
    // El comprobante llega como el archivo crudo (no multipart): un solo recurso, un solo archivo,
    // con su propio tope. El tipo real se decide por los bytes en la acción (ADR 0024).
    app.addContentTypeParser(
      [...TIPOS_DE_COMPROBANTE],
      { parseAs: 'buffer', bodyLimit: MAX_BYTES_DE_COMPROBANTE },
      (_request, cuerpo, hecho) => {
        hecho(null, cuerpo);
      },
    );

    app.post(
      '/plataforma/comprobantes',
      {
        schema: { tags: ETIQUETA, response: { 201: respuestaDeComprobante } },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('suscripciones.pago.registrar'),
        bodyLimit: MAX_BYTES_DE_COMPROBANTE,
      },
      async (request, reply) => {
        const cuerpo = request.body;
        const comprobante = await subirComprobante(
          pool,
          almacen,
          Buffer.isBuffer(cuerpo) ? cuerpo : Buffer.alloc(0),
        );
        return reply
          .status(201)
          .header('location', `/api/v1/plataforma/comprobantes/${comprobante.id}`)
          .send(comprobante);
      },
    );

    app.get(
      '/plataforma/comprobantes/:id',
      {
        schema: { tags: ETIQUETA, params: parametrosDeComprobante },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('suscripciones.suscripcion.ver'),
      },
      async (request, reply) => {
        const { contenido, tipoMime } = await leerComprobante(pool, almacen, request.params.id);
        return reply
          .type(tipoMime)
          .header('x-content-type-options', 'nosniff')
          .header('cache-control', 'private, max-age=3600')
          .send(contenido);
      },
    );
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

    app.post(
      '/plataforma/planes',
      {
        schema: {
          tags: ETIQUETA,
          body: cuerpoDePlanNuevo,
          response: { 201: respuestaDePlanCreado },
        },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('suscripciones.plan.crear'),
      },
      async (request, reply) => {
        const plan = await gestionarPlanes.crear(pool, {
          nombre: request.body.nombre,
          cupoUsuarios: request.body.cupo_usuarios,
          precioAnual: request.body.precio_anual,
        });
        return reply
          .status(201)
          .header('location', `/api/v1/plataforma/planes/${plan.id}`)
          .send(plan);
      },
    );

    app.patch(
      '/plataforma/planes/:id',
      {
        schema: { tags: ETIQUETA, params: parametrosDePlan, body: cuerpoDeEdicionDePlan },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('suscripciones.plan.editar'),
      },
      async (request, reply) => {
        await gestionarPlanes.editar(pool, request.params.id, {
          nombre: request.body.nombre,
          cupoUsuarios: request.body.cupo_usuarios,
          precioAnual: request.body.precio_anual,
        });
        return reply.status(204).send();
      },
    );

    app.delete(
      '/plataforma/planes/:id',
      {
        schema: {
          tags: ETIQUETA,
          params: parametrosDePlan,
          response: { 200: respuestaDePlanRetirado },
        },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('suscripciones.plan.eliminar'),
      },
      (request) => gestionarPlanes.retirar(pool, request.params.id),
    );

    // Las cuentas donde AGROCOM recibe los pagos (ADR 0029): de plataforma, sin cuenta de por medio.
    app.get(
      '/plataforma/cuentas-de-cobro',
      {
        schema: { tags: ETIQUETA, response: { 200: respuestaDeCuentasDeCobro } },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('suscripciones.cobro.ver'),
      },
      async () => ({ datos: await gestionarCuentasDeCobro.listar(pool) }),
    );

    app.post(
      '/plataforma/cuentas-de-cobro',
      {
        schema: {
          tags: ETIQUETA,
          body: cuerpoDeCuentaDeCobroNueva,
          response: { 201: respuestaDePlanCreado },
        },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('suscripciones.cobro.crear'),
      },
      async (request, reply) => {
        const cuerpo = request.body;
        const cuenta = await gestionarCuentasDeCobro.crear(pool, {
          metodo: cuerpo.metodo,
          banco: cuerpo.banco,
          titular: cuerpo.titular ?? null,
          numeroCuenta: cuerpo.numero_cuenta ?? null,
          tipoCuenta: cuerpo.tipo_cuenta ?? null,
          imagenId: cuerpo.imagen_id ?? null,
          nota: cuerpo.nota ?? null,
        });
        return reply
          .status(201)
          .header('location', `/api/v1/plataforma/cuentas-de-cobro/${cuenta.id}`)
          .send(cuenta);
      },
    );

    app.patch(
      '/plataforma/cuentas-de-cobro/:id',
      {
        schema: {
          tags: ETIQUETA,
          params: parametrosDeCuentaDeCobro,
          body: cuerpoDeEdicionDeCuentaDeCobro,
        },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('suscripciones.cobro.editar'),
      },
      async (request, reply) => {
        const cuerpo = request.body;
        await gestionarCuentasDeCobro.editar(pool, request.params.id, {
          banco: cuerpo.banco,
          titular: cuerpo.titular,
          numeroCuenta: cuerpo.numero_cuenta,
          tipoCuenta: cuerpo.tipo_cuenta,
          imagenId: cuerpo.imagen_id,
          nota: cuerpo.nota,
          activo: cuerpo.activo,
        });
        return reply.status(204).send();
      },
    );

    app.delete(
      '/plataforma/cuentas-de-cobro/:id',
      {
        schema: { tags: ETIQUETA, params: parametrosDeCuentaDeCobro },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('suscripciones.cobro.eliminar'),
      },
      async (request, reply) => {
        await gestionarCuentasDeCobro.eliminar(pool, request.params.id);
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
            comprobanteId: request.body.comprobante_id,
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
