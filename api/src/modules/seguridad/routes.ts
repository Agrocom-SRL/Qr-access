import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { esquemaPaginacion } from '../../platform/http/paginacion.js';
import {
  borrarCookieDeRefresco,
  clienteWebDe,
  exigirOrigenPropio,
  fijarCookieDeRefresco,
  refrescoDeLaCookie,
} from '../../platform/http/refresco-en-cookie.js';
import { permiso, tienePermiso, usuarioDe } from '../../plugins/permisos.js';
import { ErrorDeDominio } from '../../platform/errores/error-de-dominio.js';
import { ejecutar as cerrarMiSesion } from './actions/cerrar-mi-sesion.js';
import { ejecutar as cerrarMisOtrasSesiones } from './actions/cerrar-mis-otras-sesiones.js';
import { ejecutar as cerrarSesion } from './actions/cerrar-sesion.js';
import { ejecutar as cerrarSesionDeUsuario } from './actions/cerrar-sesion-de-usuario.js';
import { ejecutar as cerrarSesionesDeUsuario } from './actions/cerrar-sesiones-de-usuario.js';
import { ejecutar as listarMisSesiones } from './actions/listar-mis-sesiones.js';
import { ejecutar as listarSesionesDeUsuario } from './actions/listar-sesiones-de-usuario.js';
import { ejecutar as compartirPin } from './actions/compartir-pin.js';
import { ejecutar as crearUsuario } from './actions/crear-usuario.js';
import { ejecutar as editarMiPerfil } from './actions/editar-mi-perfil.js';
import { ejecutar as editarUsuario } from './actions/editar-usuario.js';
import { ejecutar as eliminarUsuario } from './actions/eliminar-usuario.js';
import { ejecutar as generarPin } from './actions/generar-pin.js';
import { ejecutar as iniciarSesion } from './actions/iniciar-sesion.js';
import { ejecutar as listarRoles } from './actions/listar-roles.js';
import { ejecutar as listarUsuarios } from './actions/listar-usuarios.js';
import { ejecutar as reactivarUsuario } from './actions/reactivar-usuario.js';
import { ejecutar as refrescarSesion } from './actions/refrescar-sesion.js';
import { ejecutar as restringirUsuario } from './actions/restringir-usuario.js';
import { ejecutar as suspenderUsuario } from './actions/suspender-usuario.js';
import { ejecutar as verEstadoDeUsuario } from './actions/ver-estado-de-usuario.js';
import { ejecutar as estadisticasDeUsuarios } from './actions/estadisticas-de-usuarios.js';
import { ejecutar as verCupo } from './actions/ver-cupo.js';
import { ejecutar as verSesionActual } from './actions/ver-sesion-actual.js';
import {
  cuerpoDeCambioDeEstado,
  cuerpoDeEdicionDeUsuario,
  cuerpoDeIngreso,
  cuerpoDeMiPerfil,
  cuerpoDeNuevoUsuario,
  consultaDeBaja,
  cuerpoDeRegeneracionDePin,
  cuerpoDeRefresco,
  esquemaUsuario,
  parametrosDeSesion,
  parametrosDeSesionDeUsuario,
  parametrosDeUsuario,
  respuestaDeSesionesCerradas,
  respuestaListadoDeSesiones,
  respuestaDeCupo,
  respuestaDeEstadoDeUsuario,
  respuestaDeEstadisticasDeUsuarios,
  respuestaDeIngreso,
  respuestaDePinGenerado,
  respuestaDeRefresco,
  respuestaDeSesionActual,
  respuestaDeMiPerfil,
  respuestaDeUsuarioCreado,
  respuestaListadoDeRoles,
  respuestaListadoDeUsuarios,
} from './schemas.js';
import { rutasDeCuentas } from './rutas-cuentas.js';
import { rutasDeEstructura } from './rutas-estructura.js';
import { rutasDePlataforma } from './rutas-plataforma.js';
import { crearServiciosDeSeguridad } from './servicios.js';

const LARGO_MAXIMO_DEL_AGENTE = 255;

export function rutas(dependencias: DependenciasDeModulo): FastifyPluginCallbackZod {
  const servicios = crearServiciosDeSeguridad(dependencias);
  const { pool } = servicios;

  return (app, _opciones, listo) => {
    app.post(
      '/sesiones',
      {
        schema: {
          tags: ['seguridad'],
          body: cuerpoDeIngreso,
          response: { 200: respuestaDeIngreso },
        },
        config: { acceso: 'publica', limite: 'login' },
      },
      async (request, reply) => {
        const { refresco, ...ingreso } = await iniciarSesion(servicios, {
          pin: request.body.pin,
          instalacionId: request.body.instalacion_id ?? null,
          plataforma: request.body.plataforma ?? null,
          dispositivo: request.body.dispositivo ?? null,
          ip: request.ip,
          agente: request.headers['user-agent']?.slice(0, LARGO_MAXIMO_DEL_AGENTE) ?? null,
          log: request.log,
        });
        // Un navegador recibe el refresco en su cookie y no en el cuerpo (ADR 0033 §5).
        const cliente = clienteWebDe(request);
        if (cliente === null) return { ...ingreso, refresco };
        fijarCookieDeRefresco(reply, cliente, refresco, servicios.config.JWT_REFRESH_DIAS);
        return ingreso;
      },
    );

    app.post(
      '/sesiones/refresco',
      {
        schema: {
          tags: ['seguridad'],
          body: cuerpoDeRefresco,
          response: { 200: respuestaDeRefresco },
        },
        config: { acceso: 'publica', limite: 'refresco' },
      },
      async (request, reply) => {
        const cliente = clienteWebDe(request);
        const enCookie = cliente === null ? undefined : refrescoDeLaCookie(request, cliente);
        // Con cookie hay que comprobar el origen (CSRF); la petición no puede traer además un cuerpo distinto.
        if (enCookie !== undefined) exigirOrigenPropio(request);
        const enCuerpo = request.body.refresco;
        if (enCookie !== undefined && enCuerpo !== undefined && enCuerpo !== enCookie) {
          throw new ErrorDeDominio('sesion.refresco_ambiguo', 400);
        }
        const presentado = enCuerpo ?? enCookie;
        try {
          if (presentado === undefined) throw new ErrorDeDominio('sesion.refresco_invalido', 401);
          const { refresco, ...sesion } = await refrescarSesion(
            servicios,
            presentado,
            new Date(),
            request.ip,
          );
          if (cliente === null) return { ...sesion, refresco };
          fijarCookieDeRefresco(reply, cliente, refresco, servicios.config.JWT_REFRESH_DIAS);
          return sesion;
        } catch (error) {
          // Un refresco rechazado no se queda en el navegador: la próxima carga no vuelve a intentarlo.
          if (cliente !== null && enCookie !== undefined) borrarCookieDeRefresco(reply, cliente);
          throw error;
        }
      },
    );

    app.get(
      '/sesiones/actual',
      { schema: { tags: ['seguridad'], response: { 200: respuestaDeSesionActual } } },
      (request) => verSesionActual(pool, usuarioDe(request)),
    );

    // Dispositivos conectados (ADR 0030 §4.1). Las sesiones PROPIAS no piden permiso: son de quien las abrió.
    app.get(
      '/sesiones',
      { schema: { tags: ['seguridad'], response: { 200: respuestaListadoDeSesiones } } },
      (request) => listarMisSesiones(pool, usuarioDe(request)),
    );

    // Antes de `/sesiones/:id`: "otras" no es un id.
    app.delete(
      '/sesiones/otras',
      { schema: { tags: ['seguridad'], response: { 200: respuestaDeSesionesCerradas } } },
      async (request) => ({ cerradas: await cerrarMisOtrasSesiones(pool, usuarioDe(request)) }),
    );

    app.delete(
      '/sesiones/:id',
      { schema: { tags: ['seguridad'], params: parametrosDeSesion } },
      async (request, reply) => {
        await cerrarMiSesion(pool, usuarioDe(request), request.params.id);
        return reply.status(204).send();
      },
    );

    // Cada persona edita su propio nombre; el PIN y los roles son del administrador de la cuenta.
    app.patch(
      '/perfil',
      {
        schema: {
          tags: ['seguridad'],
          body: cuerpoDeMiPerfil,
          response: { 200: respuestaDeMiPerfil },
        },
      },
      (request) => editarMiPerfil(pool, usuarioDe(request), request.body.etiqueta),
    );

    app.delete('/sesiones/actual', { schema: { tags: ['seguridad'] } }, async (request, reply) => {
      await cerrarSesion(servicios, usuarioDe(request));
      // Se borra la cookie en cualquier caso: en un cliente que no la usa no hace nada.
      borrarCookieDeRefresco(reply, 'app');
      return reply.status(204).send();
    });

    // Un superior ve y cierra las sesiones de su rama (ADR 0030 §4.1, ADR 0028 §4); quien no es de su rama es 404.
    app.get(
      '/usuarios/:id/sesiones',
      {
        schema: {
          tags: ['seguridad'],
          params: parametrosDeUsuario,
          response: { 200: respuestaListadoDeSesiones },
        },
        preHandler: permiso('seguridad.sesion.ver'),
      },
      (request) => listarSesionesDeUsuario(pool, usuarioDe(request), request.params.id),
    );

    app.delete(
      '/usuarios/:id/sesiones',
      {
        schema: {
          tags: ['seguridad'],
          params: parametrosDeUsuario,
          response: { 200: respuestaDeSesionesCerradas },
        },
        preHandler: permiso('seguridad.sesion.cerrar'),
      },
      async (request) => ({
        cerradas: await cerrarSesionesDeUsuario(pool, usuarioDe(request), request.params.id),
      }),
    );

    app.delete(
      '/usuarios/:id/sesiones/:sesionId',
      {
        schema: { tags: ['seguridad'], params: parametrosDeSesionDeUsuario },
        preHandler: permiso('seguridad.sesion.cerrar'),
      },
      async (request, reply) => {
        const { id, sesionId } = request.params;
        await cerrarSesionDeUsuario(pool, usuarioDe(request), id, sesionId);
        return reply.status(204).send();
      },
    );

    // El porcentaje y los avisos del cupo los ve solo el Administrador (ADR 0028 §6).
    app.get(
      '/cupo',
      {
        schema: { tags: ['seguridad'], response: { 200: respuestaDeCupo } },
        preHandler: permiso('seguridad.cupo.ver'),
      },
      (request) => verCupo(pool, usuarioDe(request)),
    );

    // El uso de la rama del actor: inactivos, ruidosos y Titulares cerca de su tope (ADR 0028 §4).
    app.get(
      '/usuarios/estadisticas',
      {
        schema: { tags: ['seguridad'], response: { 200: respuestaDeEstadisticasDeUsuarios } },
        preHandler: permiso('seguridad.estadistica.ver'),
      },
      (request) => estadisticasDeUsuarios(pool, usuarioDe(request)),
    );

    app.get(
      '/roles',
      {
        schema: { tags: ['seguridad'], response: { 200: respuestaListadoDeRoles } },
        preHandler: permiso('seguridad.usuario.ver'),
      },
      () => listarRoles(pool),
    );

    app.get(
      '/usuarios',
      {
        schema: {
          tags: ['seguridad'],
          querystring: esquemaPaginacion,
          response: { 200: respuestaListadoDeUsuarios },
        },
        preHandler: permiso('seguridad.usuario.ver'),
      },
      (request) => listarUsuarios(pool, usuarioDe(request), request.query),
    );

    app.post(
      '/usuarios',
      {
        schema: {
          tags: ['seguridad'],
          body: cuerpoDeNuevoUsuario,
          response: { 201: respuestaDeUsuarioCreado },
        },
        preHandler: permiso('seguridad.usuario.crear'),
      },
      async (request, reply) => {
        const usuario = await crearUsuario(servicios, usuarioDe(request), {
          etiqueta: request.body.etiqueta,
          rolIds: request.body.rol_ids,
          ...(request.body.sufijo === undefined ? {} : { sufijo: request.body.sufijo }),
          ...(request.body.unidad === undefined
            ? {}
            : {
                unidad: {
                  sitioId: request.body.unidad.sitio_id,
                  nombre: request.body.unidad.nombre,
                },
              }),
        });
        return reply.status(201).header('location', `/api/v1/usuarios/${usuario.id}`).send(usuario);
      },
    );

    app.patch(
      '/usuarios/:id',
      {
        schema: {
          tags: ['seguridad'],
          params: parametrosDeUsuario,
          body: cuerpoDeEdicionDeUsuario,
          response: { 200: esquemaUsuario },
        },
        preHandler: permiso('seguridad.usuario.editar'),
      },
      (request) =>
        editarUsuario(pool, usuarioDe(request), request.params.id, request.body.etiqueta),
    );

    app.delete(
      '/usuarios/:id',
      {
        schema: { tags: ['seguridad'], params: parametrosDeUsuario, querystring: consultaDeBaja },
        preHandler: permiso('seguridad.usuario.eliminar'),
      },
      async (request, reply) => {
        await eliminarUsuario(pool, usuarioDe(request), request.params.id, request.query.confirmar);
        return reply.status(204).send();
      },
    );

    // Estados (ADR 0033 §1, D-25): restringir y suspender arrastran a toda la rama del usuario; el motivo
    // es obligatorio. Reactivar exige el permiso del estado que levanta (lo comprueba la acción).
    app.get(
      '/usuarios/:id/estado',
      {
        schema: {
          tags: ['seguridad'],
          params: parametrosDeUsuario,
          response: { 200: respuestaDeEstadoDeUsuario },
        },
        preHandler: permiso('seguridad.usuario.ver'),
      },
      (request) => verEstadoDeUsuario(pool, usuarioDe(request), request.params.id),
    );

    app.post(
      '/usuarios/:id/restriccion',
      {
        schema: { tags: ['seguridad'], params: parametrosDeUsuario, body: cuerpoDeCambioDeEstado },
        preHandler: permiso('seguridad.usuario.restringir'),
      },
      async (request, reply) => {
        await restringirUsuario(pool, usuarioDe(request), request.params.id, request.body.motivo);
        return reply.status(204).send();
      },
    );

    app.post(
      '/usuarios/:id/suspension',
      {
        schema: { tags: ['seguridad'], params: parametrosDeUsuario, body: cuerpoDeCambioDeEstado },
        preHandler: permiso('seguridad.usuario.suspender'),
      },
      async (request, reply) => {
        await suspenderUsuario(pool, usuarioDe(request), request.params.id, request.body.motivo);
        return reply.status(204).send();
      },
    );

    app.post(
      '/usuarios/:id/reactivacion',
      {
        schema: { tags: ['seguridad'], params: parametrosDeUsuario },
        preHandler: (request) => {
          const usuario = usuarioDe(request);
          const puede =
            tienePermiso(usuario, 'seguridad.usuario.restringir') ||
            tienePermiso(usuario, 'seguridad.usuario.suspender');
          return puede
            ? Promise.resolve()
            : Promise.reject(
                new ErrorDeDominio('permiso.denegado', 403, {
                  permiso: 'seguridad.usuario.restringir',
                }),
              );
        },
      },
      async (request, reply) => {
        await reactivarUsuario(pool, usuarioDe(request), request.params.id);
        return reply.status(204).send();
      },
    );

    // Regenerar el PIN es editar al usuario: el anterior deja de servir (ADR 0018 §2).
    app.post(
      '/usuarios/:id/pin',
      {
        schema: {
          tags: ['seguridad'],
          params: parametrosDeUsuario,
          body: cuerpoDeRegeneracionDePin.nullish(),
          response: { 200: respuestaDePinGenerado },
        },
        preHandler: permiso('seguridad.usuario.editar'),
      },
      (request) =>
        generarPin(
          servicios,
          usuarioDe(request),
          request.params.id,
          new Date(),
          request.body?.sufijo,
        ),
    );
    // Anota que el PIN se compartió por un canal de terceros: solo el nivel superior, y queda en la bitácora.
    app.post(
      '/usuarios/:id/pin/compartido',
      {
        schema: { tags: ['seguridad'], params: parametrosDeUsuario },
        preHandler: permiso('seguridad.usuario.editar'),
      },
      async (request, reply) => {
        await compartirPin(pool, usuarioDe(request), request.params.id);
        return reply.status(204).send();
      },
    );
    app.register(rutasDePlataforma(servicios));
    app.register(rutasDeCuentas(servicios));
    app.register(rutasDeEstructura(servicios));
    listo();
  };
}
