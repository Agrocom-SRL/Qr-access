import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { ErrorDeDominio } from '../../platform/errores/error-de-dominio.js';
import { esquemaPaginacion } from '../../platform/http/paginacion.js';
import { permisoDePlataforma, plataformaDe } from '../../plugins/permisos.js';
import { ejecutar as agregarMiembro } from './actions/agregar-miembro-equipo.js';
import { ejecutar as cambiarContrasena } from './actions/cambiar-contrasena.js';
import { ejecutar as cerrarSesion } from './actions/cerrar-sesion-plataforma.js';
import { ejecutar as editarMiembro } from './actions/editar-miembro-equipo.js';
import { ejecutar as editarPerfil } from './actions/editar-perfil-plataforma.js';
import { ejecutar as iniciarSesion } from './actions/iniciar-sesion-plataforma.js';
import { ejecutar as listarEquipo } from './actions/listar-equipo.js';
import { ejecutar as usuarioDisponible } from './actions/usuario-disponible.js';
import { ejecutar as verPerfil } from './actions/ver-perfil-plataforma.js';
import {
  consultaDeUsuarioDisponible,
  cuerpoDeCambioDeContrasena,
  cuerpoDeEdicionDeMiembro,
  cuerpoDeEdicionDePerfil,
  cuerpoDeIngresoDePlataforma,
  cuerpoDeNuevoMiembro,
  parametrosDeUsuario,
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
      (request) =>
        iniciarSesion(servicios, {
          usuario: request.body.usuario,
          contrasena: request.body.contrasena,
          ip: request.ip,
          agente: request.headers['user-agent']?.slice(0, LARGO_MAXIMO_DEL_AGENTE) ?? null,
          log: request.log,
        }),
    );

    app.delete(
      '/plataforma/sesiones/actual',
      { schema: { tags: ETIQUETA }, config: { acceso: 'plataforma' } },
      async (request, reply) => {
        await cerrarSesion(servicios, plataformaDe(request));
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
        const { nombre, activo } = request.body;
        const requeridos = [
          ...(nombre !== undefined || activo === true ? ['seguridad.equipo.editar'] : []),
          ...(activo === false ? ['seguridad.equipo.desactivar'] : []),
        ];
        for (const codigo of requeridos) {
          if (!principal.permisos.has(codigo)) {
            throw new ErrorDeDominio('permiso.denegado', 403, { permiso: codigo });
          }
        }
        await editarMiembro(servicios, principal, request.params.id, { nombre, activo });
        return reply.status(204).send();
      },
    );

    listo();
  };
