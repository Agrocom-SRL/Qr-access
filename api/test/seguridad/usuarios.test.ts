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
  PERMISOS_DE_TITULAR,
  PERMISOS_DE_USUARIO,
  type Escenario,
  type UsuarioDePrueba,
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

describe('usuarios de la cuenta: árbol por rama y PIN generados por el servidor (HU-06, ADR 0018, ADR 0028)', () => {
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
  const generarPin = (sesion: Sesion, id: string, payload?: object) =>
    prueba.app.inject({
      method: 'POST',
      url: `/api/v1/usuarios/${id}/pin`,
      headers: conUsuario(sesion),
      ...(payload === undefined ? {} : { payload }),
    });
  const ingresar = (pin: string) =>
    prueba.app.inject({ method: 'POST', url: '/api/v1/sesiones', payload: { pin } });

  /**
   * La cuenta A con dos ramas: la del administrador del escenario (un Titular con un Miembro, además
   * del Miembro `a.usuario`) y la de un segundo Administrador de la MISMA cuenta (otro Titular con su
   * Miembro). Ninguna rama debe ver a la otra.
   */
  async function armarRamas(): Promise<{
    titular: UsuarioDePrueba;
    miembro: UsuarioDePrueba;
    admin2: UsuarioDePrueba;
    titular2: UsuarioDePrueba;
    miembro2: UsuarioDePrueba;
  }> {
    const { pool } = prueba;
    const titular = await crearUsuarioConPin(pool, a.cuenta, 'TI01', [a.rolTitularId], {
      superiorId: a.administrador.id,
    });
    const miembro = await crearUsuarioConPin(pool, a.cuenta, 'MI01', [a.rolMiembroId], {
      superiorId: titular.id,
    });
    const admin2 = await crearUsuarioConPin(pool, a.cuenta, 'AD02', [a.rolAdministradorId]);
    const titular2 = await crearUsuarioConPin(pool, a.cuenta, 'TI02', [a.rolTitularId], {
      superiorId: admin2.id,
    });
    const miembro2 = await crearUsuarioConPin(pool, a.cuenta, 'MI02', [a.rolMiembroId], {
      superiorId: titular2.id,
    });
    return { titular, miembro, admin2, titular2, miembro2 };
  }

  describe('GET /api/v1/usuarios', () => {
    it('lista solo la rama del actor con su rol y su último ingreso, sin nada del PIN', async () => {
      const { titular, miembro } = await armarRamas();
      const respuesta = await listar(sesionAdminA);
      expect(respuesta.statusCode).toBe(200);
      const cuerpo = respuesta.json<{ datos: UsuarioListado[]; meta: object }>();
      // La rama: el Miembro directo, el Titular y el Miembro del Titular. No el propio actor.
      expect(cuerpo.meta).toEqual({ pagina: 1, por_pagina: 25, total: 3 });
      expect(cuerpo.datos.map((u) => u.id).sort()).toEqual(
        [a.usuario.id, titular.id, miembro.id].sort(),
      );
      expect(cuerpo.datos.find((u) => u.id === a.usuario.id)).toEqual({
        id: a.usuario.id,
        etiqueta: `Usuario ${a.usuario.pin}`,
        activo: true,
        roles: [{ id: a.rolMiembroId, nombre: 'Miembro' }],
        pin_generado_at: fechaIsoUtc(),
        ultimo_ingreso_at: null,
        created_at: fechaIsoUtc(),
      });
      expect(respuesta.body).not.toContain('pin_hash');
      expect(respuesta.body).not.toContain('pin_indice');
    });

    it('ramas: un Administrador no ve la rama de otro de la misma cuenta, ni un igual ni un superior', async () => {
      const { titular, miembro, admin2, titular2, miembro2 } = await armarRamas();
      const ids = async (sesion: Sesion): Promise<string[]> =>
        (await listar(sesion)).json<{ datos: UsuarioListado[] }>().datos.map((u) => u.id);

      const deAdmin1 = await ids(sesionAdminA);
      for (const ajeno of [admin2.id, titular2.id, miembro2.id, a.administrador.id]) {
        expect(deAdmin1).not.toContain(ajeno);
      }
      const sesionAdmin2 = await iniciarSesion(prueba.app, admin2.pin);
      expect((await ids(sesionAdmin2)).sort()).toEqual([titular2.id, miembro2.id].sort());

      // Un Titular ve solo a sus Miembros: ni a su Administrador, ni a otro Titular.
      const sesionTitular = await iniciarSesion(prueba.app, titular.pin);
      expect(await ids(sesionTitular)).toEqual([miembro.id]);
    });

    it('aislamiento: la cuenta A nunca ve usuarios de la B', async () => {
      const ids = (await listar(sesionAdminA))
        .json<{ datos: UsuarioListado[] }>()
        .datos.map((u) => u.id);
      expect(ids).not.toContain(b.administrador.id);
      expect(ids).not.toContain(b.usuario.id);
    });

    it('exige seguridad.usuario.ver: un Miembro no lista a nadie', async () => {
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
          { id: a.rolMiembroId, nombre: 'Miembro' },
          { id: a.rolTitularId, nombre: 'Titular' },
        ],
      });
    });
  });

  describe('POST /api/v1/usuarios', () => {
    it('crea un Titular con los 4 caracteres que eligió el administrador', async () => {
      const respuesta = await crear(sesionAdminA, {
        etiqueta: 'Casa 12',
        rol_ids: [a.rolTitularId],
        sufijo: 'c012',
      });
      expect(respuesta.statusCode, respuesta.body).toBe(201);
      expect(respuesta.json<{ pin: string }>().pin).toBe('AAAC012');
      expect((await ingresar('AAAC012')).statusCode).toBe(200);
      const repetido = await crear(sesionAdminA, {
        etiqueta: 'Otro',
        rol_ids: [a.rolTitularId],
        sufijo: 'C012',
      });
      expect(repetido.statusCode).toBe(409);
    });

    it('crea un Titular con un PIN de 7 caracteres que entra, lo muestra una sola vez y lo cuelga de quien lo creó', async () => {
      const respuesta = await crear(sesionAdminA, {
        etiqueta: '  Jorge Rivero ',
        rol_ids: [a.rolTitularId],
      });
      expect(respuesta.statusCode, respuesta.body).toBe(201);
      const creado = respuesta.json<UsuarioListado & { pin: string }>();
      expect(creado).toEqual({
        id: cualquierTexto(),
        etiqueta: 'Jorge Rivero',
        activo: true,
        roles: [{ id: a.rolTitularId, nombre: 'Titular' }],
        pin_generado_at: fechaIsoUtc(),
        ultimo_ingreso_at: null,
        created_at: fechaIsoUtc(),
        pin: expect.stringMatching(PIN) as string,
      });
      expect(respuesta.headers.location).toBe(`/api/v1/usuarios/${creado.id}`);
      expect(creado.pin.startsWith('AAA')).toBe(true);

      // Queda debajo de quien lo creó en el árbol (ADR 0028 §1)
      const [vinculo] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT superior_id FROM usuarios WHERE id = ?',
        [creado.id],
      );
      expect(String(vinculo[0]?.superior_id)).toBe(a.administrador.id);

      // El PIN entra en la cuenta y con el rol asignado
      const ingreso = await ingresar(creado.pin);
      expect(ingreso.statusCode).toBe(200);
      expect(ingreso.json()).toMatchObject({
        usuario: { id: creado.id, etiqueta: 'Jorge Rivero' },
        rol_activo_id: a.rolTitularId,
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

    it('cada nivel crea solo el de abajo (ADR 0028 §3)', async () => {
      const rolGuardia = await crearRol(prueba.pool, a.cuenta, 'Guardia', [
        'organizacion.puerta.ver',
        'accesos.evento.ver',
      ]);
      const { titular } = await armarRamas();
      const sesionTitular = await iniciarSesion(prueba.app, titular.pin);
      const usuariosAntes = await contarFilas(prueba.pool, 'usuarios', 'tenant_id = ?', [
        a.cuenta.id,
      ]);

      // El Administrador crea Titulares y Guardias, pero no Miembros ni otro Administrador
      expect(
        (await crear(sesionAdminA, { etiqueta: 'T', rol_ids: [a.rolTitularId] })).statusCode,
      ).toBe(201);
      expect((await crear(sesionAdminA, { etiqueta: 'G', rol_ids: [rolGuardia] })).statusCode).toBe(
        201,
      );
      const miembroDeAdmin = await crear(sesionAdminA, {
        etiqueta: 'M',
        rol_ids: [a.rolMiembroId],
      });
      expect(miembroDeAdmin.statusCode).toBe(403);
      expect(miembroDeAdmin.json()).toMatchObject({ code: 'usuario.nivel_no_permitido' });
      const adminDeAdmin = await crear(sesionAdminA, {
        etiqueta: 'A',
        rol_ids: [a.rolAdministradorId],
      });
      expect(adminDeAdmin.statusCode).toBe(403);

      // El Titular crea Miembros y nada más: ni un igual ni un Guardia
      const miembroDeTitular = await crear(sesionTitular, {
        etiqueta: 'Hijo',
        rol_ids: [a.rolMiembroId],
      });
      expect(miembroDeTitular.statusCode, miembroDeTitular.body).toBe(201);
      const [vinculo] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT superior_id FROM usuarios WHERE id = ?',
        [miembroDeTitular.json<{ id: string }>().id],
      );
      expect(String(vinculo[0]?.superior_id)).toBe(titular.id);
      const titularDeTitular = await crear(sesionTitular, {
        etiqueta: 'Otro titular',
        rol_ids: [a.rolTitularId],
      });
      expect(titularDeTitular.statusCode).toBe(403);
      expect(titularDeTitular.json()).toMatchObject({ code: 'usuario.nivel_no_permitido' });
      expect(
        (await crear(sesionTitular, { etiqueta: 'G', rol_ids: [rolGuardia] })).statusCode,
      ).toBe(403);

      // Solo se crearon los tres permitidos
      expect(await contarFilas(prueba.pool, 'usuarios', 'tenant_id = ?', [a.cuenta.id])).toBe(
        usuariosAntes + 3,
      );
    });

    it('un rol sin nivel en el árbol no crea a nadie', async () => {
      // Con permisos de sobra para que D-19 no sea lo que lo frene: lo frena que su rol no tiene nivel
      const rolCreador = await crearRol(prueba.pool, a.cuenta, 'Creador', [...PERMISOS_DE_TITULAR]);
      const creador = await crearUsuarioConPin(prueba.pool, a.cuenta, 'CR01', [rolCreador], {
        superiorId: a.administrador.id,
      });
      const sesion = await iniciarSesion(prueba.app, creador.pin);
      const respuesta = await crear(sesion, { etiqueta: 'M', rol_ids: [a.rolMiembroId] });
      expect(respuesta.statusCode).toBe(403);
      expect(respuesta.json()).toMatchObject({ code: 'usuario.nivel_no_permitido' });
    });

    it('respeta el límite max_usuarios del plan (ADR 0017)', async () => {
      await prueba.pool.query('UPDATE planes SET max_usuarios = 2');
      const respuesta = await crear(sesionAdminA, {
        etiqueta: 'Tercero',
        rol_ids: [a.rolTitularId],
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
      const respuesta = await crear(sesionAdminA, { etiqueta: 'Nuevo', rol_ids: [a.rolTitularId] });
      expect(respuesta.statusCode).toBe(403);
      expect(respuesta.json()).toMatchObject({ code: 'suscripcion.vencida' });
    });

    it('D-19: nadie asigna un rol con permisos que su propio rol no tiene', async () => {
      // Cuenta aparte con un Titular recortado: no puede dar un Miembro con más permisos que él
      const cuenta = await crearCuenta(prueba.pool, 'CCC');
      await crearSuscripcion(prueba.pool, cuenta);
      const rolTitular = await crearRol(prueba.pool, cuenta, 'Titular', [
        'seguridad.usuario.ver',
        'seguridad.usuario.crear',
        'accesos.qr.emitir',
      ]);
      const rolMiembro = await crearRol(prueba.pool, cuenta, 'Miembro', PERMISOS_DE_USUARIO);
      const titular = await crearUsuarioConPin(prueba.pool, cuenta, 'TI01', [rolTitular]);
      const sesion = await iniciarSesion(prueba.app, titular.pin);

      const excedido = await crear(sesion, { etiqueta: 'Hijo', rol_ids: [rolMiembro] });
      expect(excedido.statusCode).toBe(422);
      expect(excedido.json()).toMatchObject({ code: 'rol.permisos_excedidos', rol_id: rolMiembro });
    });

    it('aislamiento: un rol de otra cuenta no existe (404)', async () => {
      const respuesta = await crear(sesionAdminA, { etiqueta: 'X', rol_ids: [b.rolTitularId] });
      expect(respuesta.statusCode).toBe(404);
      expect(respuesta.json()).toMatchObject({ code: 'rol.no_encontrado' });
      expect(await contarFilas(prueba.pool, 'usuarios', 'tenant_id = ?', [a.cuenta.id])).toBe(2);
    });

    it('valida el cuerpo (un solo rol) y exige seguridad.usuario.crear', async () => {
      expect(
        (await crear(sesionAdminA, { etiqueta: '', rol_ids: [a.rolTitularId] })).statusCode,
      ).toBe(400);
      expect((await crear(sesionAdminA, { etiqueta: 'Sin rol', rol_ids: [] })).statusCode).toBe(
        400,
      );
      expect(
        (
          await crear(sesionAdminA, {
            etiqueta: 'Dos roles',
            rol_ids: [a.rolTitularId, a.rolMiembroId],
          })
        ).statusCode,
      ).toBe(400);
      const sesionUsuario = await iniciarSesion(prueba.app, a.usuario.pin);
      expect(
        (await crear(sesionUsuario, { etiqueta: 'X', rol_ids: [a.rolMiembroId] })).statusCode,
      ).toBe(403);
    });

    it('dos PIN sorteados iguales en la misma cuenta no chocan: se sortea otro', async () => {
      // Con una cuenta de prueba cuyo único sufijo posible ya existe no se puede forzar el choque
      // sin tocar el sorteo; se verifica que diez altas seguidas dan PIN distintos y válidos.
      const pines = new Set<string>();
      for (let i = 0; i < 10; i += 1) {
        const respuesta = await crear(sesionAdminA, {
          etiqueta: `U${i}`,
          rol_ids: [a.rolTitularId],
        });
        expect(respuesta.statusCode).toBe(201);
        pines.add(respuesta.json<{ pin: string }>().pin);
      }
      expect(pines.size).toBe(10);
    });
  });

  describe('PATCH /api/v1/usuarios/:id', () => {
    it('cambia la etiqueta de un usuario de la rama y el rol no se toca', async () => {
      const respuesta = await editar(sesionAdminA, a.usuario.id, {
        etiqueta: 'Compras',
        rol_ids: [a.rolAdministradorId],
      });
      expect(respuesta.statusCode, respuesta.body).toBe(200);
      expect(respuesta.json()).toMatchObject({
        id: a.usuario.id,
        etiqueta: 'Compras',
        roles: [{ id: a.rolMiembroId, nombre: 'Miembro' }],
      });
      expect(
        await contarFilas(prueba.pool, 'usuario_roles', 'usuario_id = ? AND deleted_at IS NULL', [
          a.usuario.id,
        ]),
      ).toBe(1);
    });

    it('ramas: no edita a quien es de otra rama, a un superior ni a sí mismo (404)', async () => {
      const { titular, miembro2, admin2 } = await armarRamas();
      const sesionTitular = await iniciarSesion(prueba.app, titular.pin);
      expect((await editar(sesionAdminA, miembro2.id, { etiqueta: 'X' })).statusCode).toBe(404);
      expect((await editar(sesionAdminA, admin2.id, { etiqueta: 'X' })).statusCode).toBe(404);
      expect((await editar(sesionAdminA, a.administrador.id, { etiqueta: 'X' })).statusCode).toBe(
        404,
      );
      expect((await editar(sesionTitular, a.usuario.id, { etiqueta: 'X' })).statusCode).toBe(404);
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT etiqueta FROM usuarios WHERE id = ?',
        [miembro2.id],
      );
      expect(filas[0]?.etiqueta).toBe(`Usuario ${miembro2.pin}`);
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

    it('con un sufijo elegido a mano, el PIN es el código de la cuenta más esos 4 caracteres', async () => {
      const respuesta = await generarPin(sesionAdminA, a.usuario.id, { sufijo: 'ab12' });
      expect(respuesta.statusCode, respuesta.body).toBe(200);
      expect(respuesta.json<{ pin: string }>().pin).toBe(`${a.cuenta.codigo}AB12`);
      expect((await ingresar(`${a.cuenta.codigo.toLowerCase()}ab12`)).statusCode).toBe(200);
    });

    it('un sufijo ya usado en la cuenta es 409; uno mal formado, 400; y el mismo en otra cuenta sirve', async () => {
      const { titular } = await armarRamas();
      await generarPin(sesionAdminA, a.usuario.id, { sufijo: 'ZZ99' });
      const repetido = await generarPin(sesionAdminA, titular.id, { sufijo: 'ZZ99' });
      expect(repetido.statusCode).toBe(409);
      expect(repetido.json<{ code: string }>().code).toBe('pin.sufijo_en_uso');
      expect((await generarPin(sesionAdminA, a.usuario.id, { sufijo: 'ab' })).statusCode).toBe(400);
      expect((await generarPin(sesionAdminA, a.usuario.id, { sufijo: 'a-b!' })).statusCode).toBe(
        400,
      );
      expect((await generarPin(sesionAdminB, b.usuario.id, { sufijo: 'ZZ99' })).statusCode).toBe(
        200,
      );
    });

    it('solo el nivel superior regenera el PIN: ni un igual, ni un superior, ni el propio (404)', async () => {
      const { titular, miembro, admin2, miembro2 } = await armarRamas();
      const sesionTitular = await iniciarSesion(prueba.app, titular.pin);
      const sesionMiembro = await iniciarSesion(prueba.app, miembro.pin);

      // El Miembro no puede (sin permiso); el Titular regenera el de su Miembro
      expect((await generarPin(sesionMiembro, titular.id)).statusCode).toBe(403);
      expect((await generarPin(sesionTitular, miembro.id)).statusCode).toBe(200);
      // Hacia arriba o hacia un costado: no existe
      expect((await generarPin(sesionTitular, a.administrador.id)).statusCode).toBe(404);
      expect((await generarPin(sesionTitular, a.usuario.id)).statusCode).toBe(404);
      expect((await generarPin(sesionAdminA, admin2.id)).statusCode).toBe(404);
      expect((await generarPin(sesionAdminA, miembro2.id)).statusCode).toBe(404);
      expect((await generarPin(sesionAdminA, a.administrador.id)).statusCode).toBe(404);
      // El PIN del otro Administrador sigue sirviendo
      expect((await ingresar(admin2.pin)).statusCode).toBe(200);
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
      expect((await listar(sesionAdminA)).json<{ meta: { total: number } }>().meta.total).toBe(0);
    });

    it('nadie se da de baja a sí mismo', async () => {
      const respuesta = await eliminar(sesionAdminA, a.administrador.id);
      expect(respuesta.statusCode).toBe(422);
      expect(respuesta.json()).toMatchObject({ code: 'usuario.propio' });
    });

    it('un usuario con otros debajo no se da de baja: no deja huérfanos', async () => {
      const { titular, miembro } = await armarRamas();
      const respuesta = await eliminar(sesionAdminA, titular.id);
      expect(respuesta.statusCode).toBe(409);
      expect(respuesta.json()).toMatchObject({ code: 'usuario.con_dependientes' });
      expect((await ingresar(titular.pin)).statusCode).toBe(200);
      // Primero el Miembro y después el Titular
      expect((await eliminar(sesionAdminA, miembro.id)).statusCode).toBe(204);
      expect((await eliminar(sesionAdminA, titular.id)).statusCode).toBe(204);
    });

    it('ramas: no da de baja a quien es de otra rama ni a un superior (404)', async () => {
      const { titular, miembro2, admin2 } = await armarRamas();
      const sesionTitular = await iniciarSesion(prueba.app, titular.pin);
      expect((await eliminar(sesionAdminA, miembro2.id)).statusCode).toBe(404);
      expect((await eliminar(sesionAdminA, admin2.id)).statusCode).toBe(404);
      expect((await eliminar(sesionTitular, a.administrador.id)).statusCode).toBe(404);
      expect((await ingresar(miembro2.pin)).statusCode).toBe(200);
    });

    it('aislamiento: un usuario de otra cuenta no existe (404) y sigue entrando', async () => {
      expect((await eliminar(sesionAdminA, b.usuario.id)).statusCode).toBe(404);
      expect((await ingresar(b.usuario.pin)).statusCode).toBe(200);
    });

    it('el límite del plan cuenta solo usuarios vigentes: dar de baja libera un lugar', async () => {
      const cuenta = await crearCuenta(prueba.pool, 'CCC');
      const rolAdmin = await crearRol(
        prueba.pool,
        cuenta,
        'Administrador',
        PERMISOS_DE_ADMINISTRADOR,
      );
      const rolTitular = await crearRol(prueba.pool, cuenta, 'Titular', PERMISOS_DE_TITULAR);
      const admin = await crearUsuarioConPin(prueba.pool, cuenta, 'AD01', [rolAdmin]);
      await crearSuscripcion(prueba.pool, cuenta, { maxUsuarios: 2 });
      const sesion = await iniciarSesion(prueba.app, admin.pin);
      const segundo = await crear(sesion, { etiqueta: 'Segundo', rol_ids: [rolTitular] });
      expect(segundo.statusCode).toBe(201);
      expect((await crear(sesion, { etiqueta: 'Tercero', rol_ids: [rolTitular] })).statusCode).toBe(
        422,
      );
      expect((await eliminar(sesion, segundo.json<{ id: string }>().id)).statusCode).toBe(204);
      expect((await crear(sesion, { etiqueta: 'Tercero', rol_ids: [rolTitular] })).statusCode).toBe(
        201,
      );
    });
  });
});
