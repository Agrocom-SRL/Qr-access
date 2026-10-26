import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { permisoDePlataforma, plataformaDe } from '../../plugins/permisos.js';
import * as administradores from './actions/administradores-de-cuenta.js';
import { ejecutar as cambiarCodigo } from './actions/cambiar-codigo-de-cuenta.js';
import { ejecutar as codigoDisponible } from './actions/codigo-disponible.js';
import { ejecutar as crearCuenta } from './actions/crear-cuenta.js';
import { ejecutar as editarCuenta } from './actions/editar-cuenta.js';
import { ejecutar as eliminarCuenta } from './actions/eliminar-cuenta.js';
import { deCuenta as estadisticasDeCuenta } from './actions/estadisticas-de-usuarios.js';
import { ejecutar as listarCuentas } from './actions/listar-cuentas.js';
import { ejecutar as reactivarCuenta } from './actions/reactivar-cuenta.js';
import { ejecutar as reactivarUsuarioDeCuenta } from './actions/reactivar-usuario-de-cuenta.js';
import { ejecutar as restringirCuenta } from './actions/restringir-cuenta.js';
import { ejecutar as suspenderCuenta } from './actions/suspender-cuenta.js';
import { ejecutar as verCobranza } from './actions/ver-cobranza.js';
import { ejecutar as verCuenta } from './actions/ver-cuenta.js';
import { ejecutar as verSuscripcionDeCuenta } from './actions/ver-suscripcion-de-cuenta.js';
import {
  consultaDeCobranza,
  cuerpoDeCambioDeEstado,
  cuerpoDeBajaDeCuenta,
  cuerpoDeCambioDeCodigo,
  cuerpoDeNuevoAdministrador,
  cuerpoDeReasignacion,
  cuerpoDeEdicionDeCuenta,
  parametrosDeAdministrador,
  respuestaDeAdministradorCreado,
  respuestaDeAdministradores,
  respuestaDeJerarquiaDeCuenta,
  respuestaDeCambioDeCodigo,
  consultaDeCodigoDeCuenta,
  consultaDeCuentas,
  cuerpoDeNuevaCuenta,
  parametrosDeCuenta,
  parametrosDeUsuarioDeCuenta,
  respuestaDeCobranza,
  respuestaDeCodigoDeCuenta,
  respuestaDeSuscripcionDeCuenta,
  respuestaDeCuentaCreada,
  respuestaDeCuentas,
  respuestaDePinGenerado,
  respuestaDeDetalleDeCuenta,
  respuestaDeEstadisticasDeCuenta,
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
          contactoApellido: cuerpo.contacto_apellido,
          contactoTelefono: cuerpo.contacto_telefono,
          contactoCorreo: cuerpo.contacto_correo,
          planId: cuerpo.plan_id,
          inicio: cuerpo.inicio,
          administradorNombre: cuerpo.administrador_nombre,
          ...(cuerpo.pago === undefined
            ? {}
            : {
                pago: {
                  monto: cuerpo.pago.monto,
                  fechaPago: cuerpo.pago.fecha_pago,
                  medio: cuerpo.pago.medio,
                  referencia: cuerpo.pago.referencia,
                  comprobanteId: cuerpo.pago.comprobante_id,
                },
              }),
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

    app.patch(
      '/plataforma/cuentas/:id',
      {
        schema: { tags: ETIQUETA, params: parametrosDeCuenta, body: cuerpoDeEdicionDeCuenta },
        config: plataforma,
        preHandler: permisoDePlataforma('seguridad.cuenta.editar'),
      },
      async (request, reply) => {
        const cuerpo = request.body;
        await editarCuenta(pool, plataformaDe(request), request.params.id, {
          razonSocial: cuerpo.razon_social,
          nit: cuerpo.nit,
          ciudad: cuerpo.ciudad,
          contactoNombre: cuerpo.contacto_nombre,
          contactoApellido: cuerpo.contacto_apellido,
          contactoTelefono: cuerpo.contacto_telefono,
          contactoCorreo: cuerpo.contacto_correo,
          maxMiembrosPorTitular: cuerpo.max_miembros_por_titular,
        });
        return reply.status(204).send();
      },
    );

    // Estados de la cuenta (ADR 0031 §0, ADR 0033 §1): restringida no genera QR pero lo ya generado abre;
    // suspendida cierra todas las sesiones y anula todos los QR vigentes. El motivo es obligatorio.
    app.post(
      '/plataforma/cuentas/:id/restriccion',
      {
        schema: { tags: ETIQUETA, params: parametrosDeCuenta, body: cuerpoDeCambioDeEstado },
        config: plataforma,
        preHandler: permisoDePlataforma('seguridad.cuenta.editar'),
      },
      async (request, reply) => {
        await restringirCuenta(pool, plataformaDe(request), request.params.id, request.body.motivo);
        return reply.status(204).send();
      },
    );

    app.post(
      '/plataforma/cuentas/:id/suspension',
      {
        schema: { tags: ETIQUETA, params: parametrosDeCuenta, body: cuerpoDeCambioDeEstado },
        config: plataforma,
        preHandler: permisoDePlataforma('seguridad.cuenta.editar'),
      },
      async (request, reply) => {
        await suspenderCuenta(pool, plataformaDe(request), request.params.id, request.body.motivo);
        return reply.status(204).send();
      },
    );

    app.post(
      '/plataforma/cuentas/:id/reactivacion',
      {
        schema: { tags: ETIQUETA, params: parametrosDeCuenta },
        config: plataforma,
        preHandler: permisoDePlataforma('seguridad.cuenta.editar'),
      },
      async (request, reply) => {
        await reactivarCuenta(pool, plataformaDe(request), request.params.id);
        return reply.status(204).send();
      },
    );

    // La salida de un usuario restringido o suspendido que nadie de la cuenta puede levantar (sin autor,
    // impuesto por AGROCOM o por quien ya no está sobre él): AGROCOM lo levanta siempre, con motivo.
    app.post(
      '/plataforma/cuentas/:id/usuarios/:usuarioId/reactivacion',
      {
        schema: {
          tags: ETIQUETA,
          params: parametrosDeUsuarioDeCuenta,
          body: cuerpoDeCambioDeEstado,
        },
        config: plataforma,
        preHandler: permisoDePlataforma('seguridad.cuenta.editar'),
      },
      async (request, reply) => {
        const { id, usuarioId } = request.params;
        await reactivarUsuarioDeCuenta(pool, plataformaDe(request), id, usuarioId);
        request.log.info(
          { cuentaId: id, usuarioId, motivo: request.body.motivo },
          'usuario reactivado por la plataforma',
        );
        return reply.status(204).send();
      },
    );

    // DELETE con cuerpo: el código de la cuenta confirma que se borra la correcta.
    app.delete(
      '/plataforma/cuentas/:id',
      {
        schema: { tags: ETIQUETA, params: parametrosDeCuenta, body: cuerpoDeBajaDeCuenta },
        config: plataforma,
        preHandler: permisoDePlataforma('seguridad.cuenta.eliminar'),
      },
      async (request, reply) => {
        await eliminarCuenta(pool, request.params.id, request.body.codigo);
        return reply.status(204).send();
      },
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
      '/plataforma/cuentas/:id/administradores',
      {
        schema: {
          tags: ETIQUETA,
          params: parametrosDeCuenta,
          response: { 200: respuestaDeAdministradores },
        },
        config: plataforma,
        preHandler: permisoDePlataforma('seguridad.cuenta.ver'),
      },
      async (request) => ({
        datos: await administradores.listar(pool, plataformaDe(request), request.params.id),
      }),
    );

    // Solo AGROCOM suma Administradores a una cuenta (ADR 0028): el PIN se ve una sola vez.
    app.post(
      '/plataforma/cuentas/:id/administradores',
      {
        schema: {
          tags: ETIQUETA,
          params: parametrosDeCuenta,
          body: cuerpoDeNuevoAdministrador,
          response: { 201: respuestaDeAdministradorCreado },
        },
        config: plataforma,
        preHandler: permisoDePlataforma('seguridad.administrador.crear'),
      },
      async (request, reply) => {
        const creado = await administradores.crear(
          servicios,
          plataformaDe(request),
          request.params.id,
          {
            etiqueta: request.body.etiqueta,
            ...(request.body.sufijo === undefined ? {} : { sufijo: request.body.sufijo }),
          },
        );
        return reply.status(201).send(creado);
      },
    );

    // El uso de los usuarios de la cuenta (inactivos, ruidosos, Titulares cerca del tope) y su cupo por rama.
    app.get(
      '/plataforma/cuentas/:id/estadisticas-de-usuarios',
      {
        schema: {
          tags: ETIQUETA,
          params: parametrosDeCuenta,
          response: { 200: respuestaDeEstadisticasDeCuenta },
        },
        config: plataforma,
        preHandler: permisoDePlataforma('seguridad.cuenta.ver'),
      },
      (request) => estadisticasDeCuenta(pool, plataformaDe(request), request.params.id),
    );

    // El árbol de la cuenta: cada Administrador con sus Guardias y Titulares.
    app.get(
      '/plataforma/cuentas/:id/jerarquia',
      {
        schema: {
          tags: ETIQUETA,
          params: parametrosDeCuenta,
          response: { 200: respuestaDeJerarquiaDeCuenta },
        },
        config: plataforma,
        preHandler: permisoDePlataforma('seguridad.cuenta.ver'),
      },
      (request) => administradores.verJerarquia(pool, plataformaDe(request), request.params.id),
    );

    // Mover un Guardia o una unidad completa (su Titular) a otro Administrador: solo AGROCOM.
    app.post(
      '/plataforma/cuentas/:id/reasignaciones',
      {
        schema: { tags: ETIQUETA, params: parametrosDeCuenta, body: cuerpoDeReasignacion },
        config: plataforma,
        preHandler: permisoDePlataforma('seguridad.administrador.reasignar'),
      },
      async (request, reply) => {
        await administradores.reasignar(pool, plataformaDe(request), request.params.id, {
          usuarioId: request.body.usuario_id,
          administradorId: request.body.administrador_id,
        });
        return reply.status(204).send();
      },
    );

    // AGROCOM solo restablece el PIN de los administradores; ellos manejan el de sus usuarios.
    app.post(
      '/plataforma/cuentas/:id/administradores/:usuarioId/pin',
      {
        schema: {
          tags: ETIQUETA,
          params: parametrosDeAdministrador,
          response: { 200: respuestaDePinGenerado },
        },
        config: plataforma,
        preHandler: permisoDePlataforma('seguridad.administrador.regenerar_pin'),
      },
      (request) =>
        administradores.regenerarPin(
          servicios,
          plataformaDe(request),
          request.params.id,
          request.params.usuarioId,
        ),
    );

    app.put(
      '/plataforma/cuentas/:id/codigo',
      {
        schema: {
          tags: ETIQUETA,
          params: parametrosDeCuenta,
          body: cuerpoDeCambioDeCodigo,
          response: { 200: respuestaDeCambioDeCodigo },
        },
        config: plataforma,
        preHandler: permisoDePlataforma('seguridad.cuenta.cambiar_codigo'),
      },
      (request) => cambiarCodigo(servicios, request.params.id, request.body.codigo),
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
