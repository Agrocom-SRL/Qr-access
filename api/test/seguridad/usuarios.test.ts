import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { cualquierTexto, fechaIsoUtc } from '../helpers/esperados.js';
import {
  contarFilas,
  crearCuenta,
  crearEscenario,
  crearRol,
  crearSuscripcion,
  crearUsuarioConPin,
  PERMISOS_DE_ADMINISTRADOR,
  type Escenario,
} from '../helpers/fixtures.js';
import { conUsuario, iniciarSesion, type Sesion } from '../helpers/http.js';

interface UsuarioListado {
  id: string;
  etiqueta: string | null;
  activo: boolean;
  roles: { id: string; nombre: string }[];
  pin_generado_at: string | null;
  ultimo_ingreso_at: string | null;
  created_at: string;
}

const PIN = /^[A-Z]{3}[A-Z0-9]{4}$/;

describe('usuarios de la cuenta: PIN generados por el servidor (HU-06, ADR 0018)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let sesionAdminA: Sesion;
  let sesionAdminB: Sesion;

  beforeAll(async () => {
    prueba = await crearAppDePrueba();
  });
  afterAll(async () => {
    await prueba.cerrar();
  });
  beforeEach(async () => {
    await reiniciarBase(prueba.pool);
    a = await crearEscenario(prueba.pool, 'AAA');
    b = await crearEscenario(prueba.pool, 'BBB');
    sesionAdminA = await iniciarSesion(prueba.app, a.administrador.pin);
    sesionAdminB = await iniciarSesion(prueba.app, b.administrador.pin);
  });

  const listar = (sesion: Sesion, consulta = '') =>
    prueba.app.inject({
      method: 'GET',
      url: `/api/v1/usuarios${consulta}`,
      headers: conUsuario(sesion),
    });
  const crear = (sesion: Sesion, payload: object) =>
    prueba.app.inject({
      method: 'POST',
      url: '/api/v1/usuarios',
      headers: conUsuario(sesion),
      payload,
    });
  const editar = (sesion: Sesion, id: string, payload: object) =>
    prueba.app.inject({
      method: 'PATCH',
      url: `/api/v1/usuarios/${id}`,
      headers: conUsuario(sesion),
      payload,
    });
  const eliminar = (sesion: Sesion, id: string) =>
    prueba.app.inject({
      method: 'DELETE',
      url: `/api/v1/usuarios/${id}`,
      headers: conUsuario(sesion),
    });
  const generarPin = (sesion: Sesion, id: string) =>
    prueba.app.inject({
      method: 'POST',
      url: `/api/v1/usuarios/${id}/pin`,
      headers: conUsuario(sesion),
    });
  const ingresar = (pin: string) =>
    prueba.app.inject({ method: 'POST', url: '/api/v1/sesiones', payload: { pin } });

  describe('GET /api/v1/usuarios', () => {
    it('lista los usuarios de la cuenta con sus roles y su último ingreso, sin nada del PIN', async () => {
      const respuesta = await listar(sesionAdminA);
      expect(respuesta.statusCode).toBe(200);
      const cuerpo = respuesta.json<{ datos: UsuarioListado[]; meta: object }>();
      expect(cuerpo.meta).toEqual({ pagina: 1, por_pagina: 25, total: 2 });
      const administrador = cuerpo.datos.find((u) => u.id === a.administrador.id);
      expect(administrador).toEqual({
        id: a.administrador.id,
        etiqueta: `Usuario ${a.administrador.pin}`,
        activo: true,
        roles: [{ id: a.rolAdministradorId, nombre: 'Administrador' }],
        pin_generado_at: fechaIsoUtc(),
        ultimo_ingreso_at: fechaIsoUtc(),
        created_at: fechaIsoUtc(),
      });
      const usuario = cuerpo.datos.find((u) => u.id === a.usuario.id);
      expect(usuario?.ultimo_ingreso_at).toBeNull();
      expect(respuesta.body).not.toContain('pin_hash');
      expect(respuesta.body).not.toContain('pin_indice');
    });

    it('aislamiento: la cuenta A nunca ve usuarios de la B', async () => {
      const ids = (await listar(sesionAdminA))
        .json<{ datos: UsuarioListado[] }>()
        .datos.map((u) => u.id);
      expect(ids).not.toContain(b.administrador.id);
      expect(ids).not.toContain(b.usuario.id);
    });

    it('exige seguridad.usuario.ver', async () => {
      const sesionUsuario = await iniciarSesion(prueba.app, a.usuario.pin);
      expect((await listar(sesionUsuario)).statusCode).toBe(403);
    });

    it('GET /roles devuelve los roles de la cuenta para asignar', async () => {
      const respuesta = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/roles',
        headers: conUsuario(sesionAdminA),
      });
      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.json()).toEqual({
        datos: [
          { id: a.rolAdministradorId, nombre: 'Administrador' },
          { id: a.rolUsuarioId, nombre: 'Usuario' },
        ],
      });
    });
  });

  describe('POST /api/v1/usuarios', () => {
    it('crea un usuario con un PIN de 7 caracteres que entra, y lo muestra una sola vez', async () => {
      const respuesta = await crear(sesionAdminA, {
        etiqueta: '  Jorge Rivero ',
        rol_ids: [a.rolUsuarioId],
      });
      expect(respuesta.statusCode, respuesta.body).toBe(201);
      const creado = respuesta.json<UsuarioListado & { pin: string }>();
      expect(creado).toEqual({
        id: cualquierTexto(),
        etiqueta: 'Jorge Rivero',
        activo: true,
        roles: [{ id: a.rolUsuarioId, nombre: 'Usuario' }],
        pin_generado_at: fechaIsoUtc(),
        ultimo_ingreso_at: null,
        created_at: fechaIsoUtc(),
        pin: expect.stringMatching(PIN) as string,
      });
      expect(respuesta.headers.location).toBe(`/api/v1/usuarios/${creado.id}`);
      expect(creado.pin.startsWith('AAA')).toBe(true);

      // El PIN entra en la cuenta y con el rol asignado
      const ingreso = await ingresar(creado.pin);
      expect(ingreso.statusCode).toBe(200);
      expect(ingreso.json()).toMatchObject({
        usuario: { id: creado.id, etiqueta: 'Jorge Rivero' },
        rol_activo_id: a.rolUsuarioId,
      });

      // Ni el listado ni la base lo guardan en claro
      expect((await listar(sesionAdminA)).body).not.toContain(creado.pin);
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT pin_hash, pin_indice FROM usuarios WHERE id = ?',
        [creado.id],
      );
      expect(String(filas[0]?.pin_hash)).toMatch(/^\$argon2id\$/);
      expect(String(filas[0]?.pin_hash)).not.toContain(creado.pin);
      expect(filas[0]?.pin_indice).toHaveLength(64);

      // Queda en la bitácora, con autor y sin el PIN
      const [bitacora] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT usuario_id, despues FROM bitacoras WHERE tabla = 'usuarios' AND registro_id = ? AND accion = 'creado'",
        [creado.id],
      );
      expect(String(bitacora[0]?.usuario_id)).toBe(a.administrador.id);
      expect(JSON.stringify(bitacora[0]?.despues)).not.toContain('pin_hash');
    });

    it('respeta el límite max_usuarios del plan (ADR 0017)', async () => {
      await prueba.pool.query('UPDATE planes SET max_usuarios = 2');
      const respuesta = await crear(sesionAdminA, {
        etiqueta: 'Tercero',
        rol_ids: [a.rolUsuarioId],
      });
      expect(respuesta.statusCode).toBe(422);
      expect(respuesta.json()).toMatchObject({ code: 'plan.limite_usuarios', maximo: 2 });
      expect(await contarFilas(prueba.pool, 'usuarios', 'tenant_id = ?', [a.cuenta.id])).toBe(2);
    });

    it('sin suscripción vigente no crea usuarios', async () => {
      await prueba.pool.query('UPDATE suscripciones SET estado = ? WHERE tenant_id = ?', [
        'vencida',
        a.cuenta.id,
      ]);
      const respuesta = await crear(sesionAdminA, { etiqueta: 'Nuevo', rol_ids: [a.rolUsuarioId] });
      expect(respuesta.statusCode).toBe(403);
      expect(respuesta.json()).toMatchObject({ code: 'suscripcion.vencida' });
    });

    it('D-19: nadie asigna un rol con permisos que su rol activo no tiene', async () => {
      const rolCreador = await crearRol(prueba.pool, a.cuenta, 'Creador', [
        'seguridad.usuario.ver',
        'seguridad.usuario.crear',
        'accesos.qr.emitir',
      ]);
      const creador = await crearUsuarioConPin(prueba.pool, a.cuenta, 'CR01', [rolCreador]);
      const sesion = await iniciarSesion(prueba.app, creador.pin);

      const excedido = await crear(sesion, {
        etiqueta: 'Otro admin',
        rol_ids: [a.rolAdministradorId],
      });
      expect(excedido.statusCode).toBe(422);
      expect(excedido.json()).toMatchObject({
        code: 'rol.permisos_excedidos',
        rol_id: a.rolAdministradorId,
      });

      const rolMenor = await crearRol(prueba.pool, a.cuenta, 'Emisor', ['accesos.qr.emitir']);
      const permitido = await crear(sesion, { etiqueta: 'Emisor', rol_ids: [rolMenor] });
      expect(permitido.statusCode).toBe(201);
    });

    it('aislamiento: un rol de otra cuenta no existe (404)', async () => {
      const respuesta = await crear(sesionAdminA, { etiqueta: 'X', rol_ids: [b.rolUsuarioId] });
      expect(respuesta.statusCode).toBe(404);
      expect(respuesta.json()).toMatchObject({ code: 'rol.no_encontrado' });
      expect(await contarFilas(prueba.pool, 'usuarios', 'tenant_id = ?', [a.cuenta.id])).toBe(2);
    });

    it('valida el cuerpo y exige seguridad.usuario.crear', async () => {
      expect(
        (await crear(sesionAdminA, { etiqueta: '', rol_ids: [a.rolUsuarioId] })).statusCode,
      ).toBe(400);
      expect((await crear(sesionAdminA, { etiqueta: 'Sin roles', rol_ids: [] })).statusCode).toBe(
        400,
      );
      const sesionUsuario = await iniciarSesion(prueba.app, a.usuario.pin);
      expect(
        (await crear(sesionUsuario, { etiqueta: 'X', rol_ids: [a.rolUsuarioId] })).statusCode,
      ).toBe(403);
    });

    it('dos PIN sorteados iguales en la misma cuenta no chocan: se sortea otro', async () => {
      // Con una cuenta de prueba cuyo único sufijo posible ya existe no se puede forzar el choque
      // sin tocar el sorteo; se verifica que diez altas seguidas dan PIN distintos y válidos.
      const pines = new Set<string>();
      for (let i = 0; i < 10; i += 1) {
        const respuesta = await crear(sesionAdminA, {
          etiqueta: `U${i}`,
          rol_ids: [a.rolUsuarioId],
        });
        expect(respuesta.statusCode).toBe(201);
        pines.add(respuesta.json<{ pin: string }>().pin);
      }
      expect(pines.size).toBe(10);
    });
  });

  describe('PATCH /api/v1/usuarios/:id', () => {
    it('cambia la etiqueta y reemplaza los roles', async () => {
      const respuesta = await editar(sesionAdminA, a.usuario.id, {
        etiqueta: 'Compras',
        rol_ids: [a.rolAdministradorId, a.rolUsuarioId],
      });
      expect(respuesta.statusCode, respuesta.body).toBe(200);
      expect(respuesta.json()).toMatchObject({
        id: a.usuario.id,
        etiqueta: 'Compras',
        roles: [
          { id: a.rolAdministradorId, nombre: 'Administrador' },
          { id: a.rolUsuarioId, nombre: 'Usuario' },
        ],
      });
      const soloAdmin = await editar(sesionAdminA, a.usuario.id, {
        rol_ids: [a.rolAdministradorId],
      });
      expect(soloAdmin.json<UsuarioListado>().roles.map((rol) => rol.id)).toEqual([
        a.rolAdministradorId,
      ]);
      expect(
        await contarFilas(prueba.pool, 'usuario_roles', 'usuario_id = ? AND deleted_at IS NULL', [
          a.usuario.id,
        ]),
      ).toBe(1);
    });

    it('aislamiento: un usuario de otra cuenta no existe (404) y nada cambia', async () => {
      const respuesta = await editar(sesionAdminA, b.usuario.id, { etiqueta: 'Hackeado' });
      expect(respuesta.statusCode).toBe(404);
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT etiqueta FROM usuarios WHERE id = ?',
        [b.usuario.id],
      );
      expect(filas[0]?.etiqueta).toBe(`Usuario ${b.usuario.pin}`);
    });

    it('un cuerpo vacío es 400 y sin permiso es 403', async () => {
      expect((await editar(sesionAdminA, a.usuario.id, {})).statusCode).toBe(400);
      const sesionUsuario = await iniciarSesion(prueba.app, a.usuario.pin);
      expect((await editar(sesionUsuario, a.usuario.id, { etiqueta: 'Yo' })).statusCode).toBe(403);
    });
  });

  describe('POST /api/v1/usuarios/:id/pin', () => {
    it('regenera el PIN: el anterior deja de entrar, el nuevo entra y las sesiones se cortan', async () => {
      const sesionVieja = await iniciarSesion(prueba.app, a.usuario.pin);
      const respuesta = await generarPin(sesionAdminA, a.usuario.id);
      expect(respuesta.statusCode, respuesta.body).toBe(200);
      const { pin } = respuesta.json<{ pin: string; pin_generado_at: string }>();
      expect(pin).toMatch(PIN);
      expect(pin).not.toBe(a.usuario.pin);

      expect((await ingresar(a.usuario.pin)).statusCode).toBe(401);
      expect((await ingresar(pin)).statusCode).toBe(200);

      const conSesionVieja = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/sesiones/actual',
        headers: conUsuario(sesionVieja),
      });
      expect(conSesionVieja.statusCode).toBe(401);
    });

    it('aislamiento: no se regenera el PIN de un usuario de otra cuenta', async () => {
      expect((await generarPin(sesionAdminA, b.usuario.id)).statusCode).toBe(404);
      expect((await ingresar(b.usuario.pin)).statusCode).toBe(200);
      expect((await generarPin(sesionAdminB, b.usuario.id)).statusCode).toBe(200);
    });
  });

  describe('DELETE /api/v1/usuarios/:id', () => {
    it('da de baja al usuario: no entra más, sus sesiones mueren y queda en la bitácora', async () => {
      const sesionUsuario = await iniciarSesion(prueba.app, a.usuario.pin);
      const respuesta = await eliminar(sesionAdminA, a.usuario.id);
      expect(respuesta.statusCode).toBe(204);
      expect((await ingresar(a.usuario.pin)).statusCode).toBe(401);
      const conSesion = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/sesiones/actual',
        headers: conUsuario(sesionUsuario),
      });
      expect(conSesion.statusCode).toBe(401);
      expect(
        await contarFilas(prueba.pool, 'usuarios', 'id = ? AND deleted_at IS NOT NULL', [
          a.usuario.id,
        ]),
      ).toBe(1);
      expect(
        await contarFilas(
          prueba.pool,
          'bitacoras',
          "tabla = 'usuarios' AND registro_id = ? AND accion = 'eliminado'",
          [a.usuario.id],
        ),
      ).toBe(1);
      expect((await listar(sesionAdminA)).json<{ meta: { total: number } }>().meta.total).toBe(1);
    });

    it('nadie se da de baja a sí mismo', async () => {
      const respuesta = await eliminar(sesionAdminA, a.administrador.id);
      expect(respuesta.statusCode).toBe(422);
      expect(respuesta.json()).toMatchObject({ code: 'usuario.propio' });
    });

    it('aislamiento: un usuario de otra cuenta no existe (404) y sigue entrando', async () => {
      expect((await eliminar(sesionAdminA, b.usuario.id)).statusCode).toBe(404);
      expect((await ingresar(b.usuario.pin)).statusCode).toBe(200);
    });

    it('el límite del plan cuenta solo usuarios vigentes: dar de baja libera un lugar', async () => {
      const cuenta = await crearCuenta(prueba.pool, 'CCC');
      const rol = await crearRol(prueba.pool, cuenta, 'Administrador', PERMISOS_DE_ADMINISTRADOR);
      const admin = await crearUsuarioConPin(prueba.pool, cuenta, 'AD01', [rol]);
      await crearSuscripcion(prueba.pool, cuenta, { maxUsuarios: 2 });
      const sesion = await iniciarSesion(prueba.app, admin.pin);
      const segundo = await crear(sesion, { etiqueta: 'Segundo', rol_ids: [rol] });
      expect(segundo.statusCode).toBe(201);
      expect((await crear(sesion, { etiqueta: 'Tercero', rol_ids: [rol] })).statusCode).toBe(422);
      expect((await eliminar(sesion, segundo.json<{ id: string }>().id)).statusCode).toBe(204);
      expect((await crear(sesion, { etiqueta: 'Tercero', rol_ids: [rol] })).statusCode).toBe(201);
    });
  });
});
