import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { ErrorDeDominio } from '../../platform/errores/error-de-dominio.js';
import { esquemaPaginacion } from '../../platform/http/paginacion.js';
import {
  borrarCookieDeRefresco,
  clienteWebDe,
  fijarCookieDeRefresco,
} from '../../platform/http/refresco-en-cookie.js';
import { permisoDePlataforma, plataformaDe } from '../../plugins/permisos.js';
import { ejecutar as agregarMiembro } from './actions/agregar-miembro-equipo.js';
import { ejecutar as cambiarContrasena } from './actions/cambiar-contrasena.js';
import { ejecutar as cerrarMiSesion } from './actions/cerrar-mi-sesion-plataforma.js';
import { ejecutar as cerrarMisOtrasSesiones } from './actions/cerrar-mis-otras-sesiones-plataforma.js';
import { ejecutar as cerrarSesion } from './actions/cerrar-sesion-plataforma.js';
import { ejecutar as editarMiembro } from './actions/editar-miembro-equipo.js';
import { ejecutar as editarPerfil } from './actions/editar-perfil-plataforma.js';
import { ejecutar as iniciarSesion } from './actions/iniciar-sesion-plataforma.js';
import { ejecutar as listarEquipo } from './actions/listar-equipo.js';
import { ejecutar as listarMisSesiones } from './actions/listar-mis-sesiones-plataforma.js';
import { ejecutar as usuarioDisponible } from './actions/usuario-disponible.js';
import { ejecutar as verPerfil } from './actions/ver-perfil-plataforma.js';
import {
  consultaDeUsuarioDisponible,
  cuerpoDeCambioDeContrasena,
  cuerpoDeEdicionDeMiembro,
  cuerpoDeEdicionDePerfil,
  cuerpoDeIngresoDePlataforma,
  cuerpoDeNuevoMiembro,
  parametrosDeSesion,
  parametrosDeUsuario,
  respuestaDeSesionesCerradas,
  respuestaListadoDeSesiones,
  respuestaDelEquipo,
  respuestaDeIngresoDePlataforma,
  respuestaDeMiembroCreado,
  respuestaDePerfilDePlataforma,
  respuestaDeUsuarioDisponible,
} from './schemas.js';
import type { ServiciosDeSeguridad } from './servicios.js';

const LARGO_MAXIMO_DEL_AGENTE = 255;
const ETIQUETA = ['plataforma'];

/**
 * Rutas del super admin bajo `/plataforma` (ADR 0004 §7, ADR 0022): ingreso con usuario y
 * contraseña, perfil y equipo AGROCOM. Todas salvo el ingreso exigen un JWT de plataforma.
 */
export const rutasDePlataforma =
  (servicios: ServiciosDeSeguridad): FastifyPluginCallbackZod =>
  (app, _opciones, listo) => {
    const { pool } = servicios;

    app.post(
      '/plataforma/sesiones',
      {
        schema: {
          tags: ETIQUETA,
          body: cuerpoDeIngresoDePlataforma,
          response: { 200: respuestaDeIngresoDePlataforma },
        },
        config: { acceso: 'publica', limite: 'login' },
      },
      async (request, reply) => {
        const { refresco, ...ingreso } = await iniciarSesion(servicios, {
          usuario: request.body.usuario,
          contrasena: request.body.contrasena,
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

    app.delete(
      '/plataforma/sesiones/actual',
      { schema: { tags: ETIQUETA }, config: { acceso: 'plataforma' } },
      async (request, reply) => {
        await cerrarSesion(servicios, plataformaDe(request));
        // Se borra la cookie en cualquier caso: en un cliente que no la usa no hace nada.
        borrarCookieDeRefresco(reply, 'panel');
        return reply.status(204).send();
      },
    );

    // Dispositivos conectados del super admin (ADR 0030 §4.1): solo los propios, sin permiso aparte.
    app.get(
      '/plataforma/sesiones',
      {
        schema: { tags: ETIQUETA, response: { 200: respuestaListadoDeSesiones } },
        config: { acceso: 'plataforma' },
      },
      (request) => listarMisSesiones(pool, plataformaDe(request)),
    );

    // Antes de `/plataforma/sesiones/:id`: "otras" no es un id.
    app.delete(
      '/plataforma/sesiones/otras',
      {
        schema: { tags: ETIQUETA, response: { 200: respuestaDeSesionesCerradas } },
        config: { acceso: 'plataforma' },
      },
      async (request) => ({ cerradas: await cerrarMisOtrasSesiones(pool, plataformaDe(request)) }),
    );

    app.delete(
      '/plataforma/sesiones/:id',
      { schema: { tags: ETIQUETA, params: parametrosDeSesion }, config: { acceso: 'plataforma' } },
      async (request, reply) => {
        await cerrarMiSesion(pool, plataformaDe(request), request.params.id);
        return reply.status(204).send();
      },
    );

    app.get(
      '/plataforma/perfil',
      {
        schema: { tags: ETIQUETA, response: { 200: respuestaDePerfilDePlataforma } },
        config: { acceso: 'plataforma' },
      },
      (request) => verPerfil(pool, plataformaDe(request)),
    );

    app.patch(
      '/plataforma/perfil',
      {
        schema: { tags: ETIQUETA, body: cuerpoDeEdicionDePerfil },
        config: { acceso: 'plataforma' },
      },
      async (request, reply) => {
        await editarPerfil(pool, plataformaDe(request), request.body.nombre);
        return reply.status(204).send();
      },
    );

    app.put(
      '/plataforma/perfil/contrasena',
      {
        schema: { tags: ETIQUETA, body: cuerpoDeCambioDeContrasena },
        config: { acceso: 'plataforma' },
      },
      async (request, reply) => {
        await cambiarContrasena(servicios, plataformaDe(request), request.body);
        return reply.status(204).send();
      },
    );

    app.get(
      '/plataforma/equipo',
      {
        schema: {
          tags: ETIQUETA,
          querystring: esquemaPaginacion,
          response: { 200: respuestaDelEquipo },
        },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('seguridad.equipo.ver'),
      },
      (request) => listarEquipo(pool, plataformaDe(request), request.query),
    );

    app.get(
      '/plataforma/equipo/usuario-disponible',
      {
        schema: {
          tags: ETIQUETA,
          querystring: consultaDeUsuarioDisponible,
          response: { 200: respuestaDeUsuarioDisponible },
        },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('seguridad.equipo.crear'),
      },
      (request) => usuarioDisponible(pool, request.query.usuario),
    );

    app.post(
      '/plataforma/equipo',
      {
        schema: {
          tags: ETIQUETA,
          body: cuerpoDeNuevoMiembro,
          response: { 201: respuestaDeMiembroCreado },
        },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('seguridad.equipo.crear'),
      },
      async (request, reply) => {
        const miembro = await agregarMiembro(servicios, plataformaDe(request), {
          nombre: request.body.nombre,
          usuario: request.body.usuario,
          contrasenaTemporal: request.body.contrasena_temporal,
        });
        return reply
          .status(201)
          .header('location', `/api/v1/plataforma/equipo/${miembro.id}`)
          .send(miembro);
      },
    );

    // Renombrar o reactivar exige `seguridad.equipo.editar`; desactivar, `seguridad.equipo.desactivar`.
    app.patch(
      '/plataforma/equipo/:id',
      {
        schema: { tags: ETIQUETA, params: parametrosDeUsuario, body: cuerpoDeEdicionDeMiembro },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('seguridad.equipo.ver'),
      },
      async (request, reply) => {
        const principal = plataformaDe(request);
        const { nombre, activo, motivo } = request.body;
        const requeridos = [
          ...(nombre !== undefined || activo === true ? ['seguridad.equipo.editar'] : []),
          ...(activo === false ? ['seguridad.equipo.desactivar'] : []),
        ];
        for (const codigo of requeridos) {
          if (!principal.permisos.has(codigo)) {
            throw new ErrorDeDominio('permiso.denegado', 403, { permiso: codigo });
          }
        }
        await editarMiembro(servicios, principal, request.params.id, { nombre, activo, motivo });
        return reply.status(204).send();
      },
    );

    listo();
  };
