import type { RowDataPacket } from 'mysql2/promise';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FALLOS_POR_IP } from '../../src/modules/seguridad/servicios.js';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { crearEscenario, crearSuperAdmin, type SuperAdminDePrueba } from '../helpers/fixtures.js';
import { conUsuario, iniciarSesionDePlataforma, type Problema } from '../helpers/http.js';
import { cualquierTexto } from '../helpers/esperados.js';

const BASE = '/api/v1/plataforma';

describe('plataforma: ingreso del super admin', () => {
  let prueba: AppDePrueba;
  let lucia: SuperAdminDePrueba;

  beforeEach(async () => {
    prueba = await crearAppDePrueba();
    await reiniciarBase(prueba.pool);
    lucia = await crearSuperAdmin(prueba.pool, 'lucia.paz', { nombre: 'Lucía Paz' });
  });
  afterEach(async () => {
    await prueba.cerrar();
  });

  const ingresar = (usuario: string, contrasena: string) =>
    prueba.app.inject({
      method: 'POST',
      url: `${BASE}/sesiones`,
      payload: { usuario, contrasena },
    });

  it('entra con usuario y contraseña y entrega el contrato', async () => {
    const respuesta = await ingresar('lucia.paz', lucia.contrasena);
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({
      acceso: cualquierTexto(),
      refresco: cualquierTexto(),
      usuario: { id: lucia.id, nombre: 'Lucía Paz', usuario: 'lucia.paz' },
      debe_cambiar_contrasena: false,
      permisos: expect.arrayContaining([
        'seguridad.equipo.crear',
        'seguridad.equipo.desactivar',
        'seguridad.equipo.ver',
      ]) as string[],
    });
  });

  it('el usuario no distingue mayúsculas', async () => {
    expect((await ingresar(' Lucia.Paz ', lucia.contrasena)).statusCode).toBe(200);
  });

  it('contraseña incorrecta y usuario inexistente responden lo mismo', async () => {
    const mala = await ingresar('lucia.paz', 'otra-contrasena-1');
    const inexistente = await ingresar('nadie.mas', 'otra-contrasena-1');
    expect(mala.statusCode).toBe(401);
    expect(inexistente.statusCode).toBe(401);
    expect(mala.json<Problema>().code).toBe('sesion.credenciales_invalidas');
    expect(inexistente.json()).toEqual(mala.json());
  });

  it('un super admin desactivado no entra', async () => {
    await crearSuperAdmin(prueba.pool, 'baja', { activo: false });
    expect((await ingresar('baja', 'contrasena-de-prueba-1')).statusCode).toBe(401);
  });

  it('bloquea tras los fallos seguidos y dice cuánto esperar', async () => {
    for (let i = 0; i < FALLOS_POR_IP; i += 1) await ingresar('lucia.paz', 'mal-mal-mal-1');
    const bloqueada = await ingresar('lucia.paz', lucia.contrasena);
    expect(bloqueada.statusCode).toBe(429);
    expect(bloqueada.json()).toMatchObject({
      code: 'sesion.bloqueada',
      reintentar_en_segundos: expect.any(Number) as number,
    });
  });

  it('los usuarios de una cuenta no entran por acá, ni un super admin por el login de PIN', async () => {
    const cuenta = await crearEscenario(prueba.pool, 'AAA');
    expect((await ingresar(cuenta.administrador.pin, 'x')).statusCode).toBe(401);
    const porPin = await prueba.app.inject({
      method: 'POST',
      url: '/api/v1/sesiones',
      payload: { pin: 'lucia.paz' },
    });
    expect(porPin.statusCode).toBe(401);
  });

  it('el JWT de plataforma no sirve en las rutas de una cuenta ni el de una cuenta en plataforma', async () => {
    const sesion = await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', lucia.contrasena);
    const enCuenta = await prueba.app.inject({
      method: 'GET',
      url: '/api/v1/usuarios',
      headers: conUsuario(sesion),
    });
    expect(enCuenta.statusCode).toBe(401);

    const cuenta = await crearEscenario(prueba.pool, 'BBB');
    const porPin = await prueba.app.inject({
      method: 'POST',
      url: '/api/v1/sesiones',
      payload: { pin: cuenta.administrador.pin },
    });
    const { acceso } = porPin.json<{ acceso: string }>();
    const enPlataforma = await prueba.app.inject({
      method: 'GET',
      url: `${BASE}/equipo`,
      headers: { authorization: `Bearer ${acceso}` },
    });
    expect(enPlataforma.statusCode).toBe(401);
  });

  it('refresca de forma rotativa y el refresh anterior deja de servir', async () => {
    const sesion = await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', lucia.contrasena);
    const refrescar = (refresco: string) =>
      prueba.app.inject({
        method: 'POST',
        url: '/api/v1/sesiones/refresco',
        payload: { refresco },
      });
    const primera = await refrescar(sesion.refresco);
    expect(primera.statusCode).toBe(200);
    const { acceso, refresco } = primera.json<{ acceso: string; refresco: string }>();
    expect(refresco).not.toBe(sesion.refresco);
    expect((await refrescar(sesion.refresco)).statusCode).toBe(401);
    const perfil = await prueba.app.inject({
      method: 'GET',
      url: `${BASE}/perfil`,
      headers: { authorization: `Bearer ${acceso}` },
    });
    expect(perfil.statusCode).toBe(200);
  });

  it('cerrar sesión revoca el JWT y el refresh', async () => {
    const sesion = await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', lucia.contrasena);
    const cerrada = await prueba.app.inject({
      method: 'DELETE',
      url: `${BASE}/sesiones/actual`,
      headers: conUsuario(sesion),
    });
    expect(cerrada.statusCode).toBe(204);
    const perfil = await prueba.app.inject({
      method: 'GET',
      url: `${BASE}/perfil`,
      headers: conUsuario(sesion),
    });
    expect(perfil.statusCode).toBe(401);
    const refrescada = await prueba.app.inject({
      method: 'POST',
      url: '/api/v1/sesiones/refresco',
      payload: { refresco: sesion.refresco },
    });
    expect(refrescada.statusCode).toBe(401);
  });

  it('sin sesión, las rutas de plataforma piden autenticación', async () => {
    for (const url of [`${BASE}/perfil`, `${BASE}/equipo`]) {
      const respuesta = await prueba.app.inject({ method: 'GET', url });
      expect(respuesta.statusCode).toBe(401);
    }
  });
});

describe('plataforma: perfil y contraseña', () => {
  let prueba: AppDePrueba;
  let lucia: SuperAdminDePrueba;

  beforeEach(async () => {
    prueba = await crearAppDePrueba();
    await reiniciarBase(prueba.pool);
    lucia = await crearSuperAdmin(prueba.pool, 'lucia.paz', { nombre: 'Lucía Paz' });
  });
  afterEach(async () => {
    await prueba.cerrar();
  });

  it('muestra el perfil con su último ingreso', async () => {
    const sesion = await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', lucia.contrasena);
    const respuesta = await prueba.app.inject({
      method: 'GET',
      url: `${BASE}/perfil`,
      headers: conUsuario(sesion),
    });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toMatchObject({
      id: lucia.id,
      nombre: 'Lucía Paz',
      usuario: 'lucia.paz',
      debe_cambiar_contrasena: false,
      ultimo_ingreso_at: cualquierTexto(),
    });
  });

  it('cambia la contraseña: la vieja deja de servir y la nueva entra', async () => {
    const sesion = await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', lucia.contrasena);
    const cambio = await prueba.app.inject({
      method: 'PUT',
      url: `${BASE}/perfil/contrasena`,
      headers: conUsuario(sesion),
      payload: { actual: lucia.contrasena, nueva: 'una-contrasena-nueva-2' },
    });
    expect(cambio.statusCode).toBe(204);
    await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', 'una-contrasena-nueva-2');
    const vieja = await prueba.app.inject({
      method: 'POST',
      url: `${BASE}/sesiones`,
      payload: { usuario: 'lucia.paz', contrasena: lucia.contrasena },
    });
    expect(vieja.statusCode).toBe(401);
  });

  it('rechaza la actual incorrecta, una nueva corta y una igual a la actual', async () => {
    const sesion = await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', lucia.contrasena);
    const cambiar = (actual: string, nueva: string) =>
      prueba.app.inject({
        method: 'PUT',
        url: `${BASE}/perfil/contrasena`,
        headers: conUsuario(sesion),
        payload: { actual, nueva },
      });
    const incorrecta = await cambiar('equivocada-1234', 'una-contrasena-nueva-2');
    expect(incorrecta.json<Problema>().code).toBe('contrasena.actual_incorrecta');
    const corta = await cambiar(lucia.contrasena, 'corta');
    expect(corta.json<Problema>().code).toBe('contrasena.invalida');
    const igual = await cambiar(lucia.contrasena, lucia.contrasena);
    expect(igual.json<Problema>().code).toBe('contrasena.sin_cambio');
  });

  it('quitar la marca de temporal al cambiarla', async () => {
    await crearSuperAdmin(prueba.pool, 'nuevo', { temporal: true, contrasena: 'temporal-12345' });
    const sesion = await iniciarSesionDePlataforma(prueba.app, 'nuevo', 'temporal-12345');
    expect(sesion.debe_cambiar_contrasena).toBe(true);
    await prueba.app.inject({
      method: 'PUT',
      url: `${BASE}/perfil/contrasena`,
      headers: conUsuario(sesion),
      payload: { actual: 'temporal-12345', nueva: 'definitiva-123456' },
    });
    const otra = await iniciarSesionDePlataforma(prueba.app, 'nuevo', 'definitiva-123456');
    expect(otra.debe_cambiar_contrasena).toBe(false);
  });
});

describe('plataforma: equipo AGROCOM', () => {
  let prueba: AppDePrueba;
  let lucia: SuperAdminDePrueba;

  beforeEach(async () => {
    prueba = await crearAppDePrueba();
    await reiniciarBase(prueba.pool);
    lucia = await crearSuperAdmin(prueba.pool, 'lucia.paz', { nombre: 'Lucía Paz' });
  });
  afterEach(async () => {
    await prueba.cerrar();
  });

  const como = async (usuario: string, contrasena: string) =>
    conUsuario(await iniciarSesionDePlataforma(prueba.app, usuario, contrasena));

  it('lista solo al equipo (nunca usuarios de una cuenta), con "es_actual" y los activos', async () => {
    await crearEscenario(prueba.pool, 'AAA');
    await crearSuperAdmin(prueba.pool, 'marco.suarez', { nombre: 'Marco Suárez' });
    await crearSuperAdmin(prueba.pool, 'diego.rojas', { nombre: 'Diego Rojas', activo: false });
    const respuesta = await prueba.app.inject({
      method: 'GET',
      url: `${BASE}/equipo`,
      headers: await como('lucia.paz', lucia.contrasena),
    });
    expect(respuesta.statusCode).toBe(200);
    const cuerpo = respuesta.json<{
      datos: { usuario: string; es_actual: boolean; activo: boolean }[];
      meta: { total: number };
      activos: number;
    }>();
    expect(cuerpo.meta.total).toBe(3);
    expect(cuerpo.activos).toBe(2);
    expect(cuerpo.datos.map((m) => m.usuario).sort()).toEqual([
      'diego.rojas',
      'lucia.paz',
      'marco.suarez',
    ]);
    expect(cuerpo.datos.find((m) => m.usuario === 'lucia.paz')?.es_actual).toBe(true);
    expect(cuerpo.datos.find((m) => m.usuario === 'diego.rojas')?.activo).toBe(false);
  });

  it('agrega a alguien con contraseña temporal: entra y tiene que cambiarla', async () => {
    const headers = await como('lucia.paz', lucia.contrasena);
    const respuesta = await prueba.app.inject({
      method: 'POST',
      url: `${BASE}/equipo`,
      headers,
      payload: {
        nombre: 'Valeria Justiniano',
        usuario: 'Valeria.Justiniano',
        contrasena_temporal: 'Qx7-mR42-pLaa',
      },
    });
    expect(respuesta.statusCode, respuesta.body).toBe(201);
    expect(respuesta.json()).toMatchObject({
      nombre: 'Valeria Justiniano',
      usuario: 'valeria.justiniano',
      activo: true,
    });
    expect(respuesta.body).not.toContain('Qx7-mR42-pLaa');
    const sesion = await iniciarSesionDePlataforma(
      prueba.app,
      'valeria.justiniano',
      'Qx7-mR42-pLaa',
    );
    expect(sesion.debe_cambiar_contrasena).toBe(true);
    expect(sesion.permisos).toContain('seguridad.equipo.ver');
  });

  it('la contraseña se guarda hasheada y la altas quedan en la bitácora sin ella', async () => {
    await prueba.app.inject({
      method: 'POST',
      url: `${BASE}/equipo`,
      headers: await como('lucia.paz', lucia.contrasena),
      payload: { nombre: 'Ana', usuario: 'ana.lopez', contrasena_temporal: 'temporal-12345' },
    });
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      "SELECT contrasena_hash FROM usuarios WHERE username = 'ana.lopez'",
    );
    expect(String(filas[0]?.contrasena_hash)).toMatch(/^\$argon2id\$/);
    const [bitacora] = await prueba.pool.query<RowDataPacket[]>(
      "SELECT despues FROM bitacoras WHERE tabla = 'usuarios' AND accion = 'creado' ORDER BY id DESC LIMIT 1",
    );
    const despues = JSON.stringify(bitacora[0]?.despues);
    expect(despues).toContain('ana.lopez');
    expect(despues).not.toContain('temporal-12345');
    expect(despues).not.toContain('contrasena_hash');
  });

  it('rechaza un usuario repetido, uno con formato inválido y una contraseña corta', async () => {
    const headers = await como('lucia.paz', lucia.contrasena);
    const crear = (usuario: string, contrasena_temporal: string) =>
      prueba.app.inject({
        method: 'POST',
        url: `${BASE}/equipo`,
        headers,
        payload: { nombre: 'X', usuario, contrasena_temporal },
      });
    expect((await crear('lucia.paz', 'temporal-12345')).json<Problema>().code).toBe(
      'usuario.existente',
    );
    expect((await crear('no válido!', 'temporal-12345')).json<Problema>().code).toBe(
      'usuario.formato_invalido',
    );
    expect((await crear('otra.persona', 'corta')).json<Problema>().code).toBe(
      'contrasena.invalida',
    );
  });

  it('dice si un usuario está disponible', async () => {
    const headers = await como('lucia.paz', lucia.contrasena);
    const consultar = async (usuario: string) =>
      (
        await prueba.app.inject({
          method: 'GET',
          url: `${BASE}/equipo/usuario-disponible`,
          headers,
          query: { usuario },
        })
      ).json<{ disponible: boolean }>().disponible;
    expect(await consultar('lucia.paz')).toBe(false);
    expect(await consultar('valeria.justiniano')).toBe(true);
    expect(await consultar('x')).toBe(false);
  });

  it('desactiva a otro, corta sus sesiones y no puede volver a entrar', async () => {
    const marco = await crearSuperAdmin(prueba.pool, 'marco.suarez');
    const sesionDeMarco = await iniciarSesionDePlataforma(
      prueba.app,
      'marco.suarez',
      marco.contrasena,
    );
    const respuesta = await prueba.app.inject({
      method: 'PATCH',
      url: `${BASE}/equipo/${marco.id}`,
      headers: await como('lucia.paz', lucia.contrasena),
      payload: { activo: false },
    });
    expect(respuesta.statusCode, respuesta.body).toBe(204);
    const conSesionVieja = await prueba.app.inject({
      method: 'GET',
      url: `${BASE}/perfil`,
      headers: conUsuario(sesionDeMarco),
    });
    expect(conSesionVieja.statusCode).toBe(401);
    const nuevoIngreso = await prueba.app.inject({
      method: 'POST',
      url: `${BASE}/sesiones`,
      payload: { usuario: 'marco.suarez', contrasena: marco.contrasena },
    });
    expect(nuevoIngreso.statusCode).toBe(401);
  });

  it('no puede desactivarse a sí mismo ni dejar al equipo sin activos', async () => {
    const headers = await como('lucia.paz', lucia.contrasena);
    const aSiMisma = await prueba.app.inject({
      method: 'PATCH',
      url: `${BASE}/equipo/${lucia.id}`,
      headers,
      payload: { activo: false },
    });
    expect(aSiMisma.statusCode).toBe(422);
    expect(aSiMisma.json<Problema>().code).toBe('equipo.no_desactivarse');
  });

  it('el último activo no se desactiva aunque lo pida otro (que ya fue desactivado)', async () => {
    const marco = await crearSuperAdmin(prueba.pool, 'marco.suarez');
    const headersDeMarco = await como('marco.suarez', marco.contrasena);
    await prueba.app.inject({
      method: 'PATCH',
      url: `${BASE}/equipo/${lucia.id}`,
      headers: headersDeMarco,
      payload: { activo: false },
    });
    // Lucía quedó desactivada; Marco es el último activo y no puede desactivarse (ni nadie más hacerlo).
    const reintento = await prueba.app.inject({
      method: 'PATCH',
      url: `${BASE}/equipo/${marco.id}`,
      headers: headersDeMarco,
      payload: { activo: false },
    });
    expect(reintento.statusCode).toBe(422);
  });

  it('un usuario inexistente da 404', async () => {
    const respuesta = await prueba.app.inject({
      method: 'PATCH',
      url: `${BASE}/equipo/999999`,
      headers: await como('lucia.paz', lucia.contrasena),
      payload: { activo: false },
    });
    expect(respuesta.statusCode).toBe(404);
  });
});
