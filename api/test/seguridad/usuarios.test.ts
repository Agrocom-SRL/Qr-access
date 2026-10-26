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
  crearSitio,
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
  estado: string;
  estado_efectivo: string;
  estado_origen: string | null;
  estado_motivo: string | null;
  estado_desde: string | null;
  estado_impuesto_por: string | null;
  roles: { id: string; nombre: string }[];
  unidad: { id: string; nombre: string; sitio_id: string } | null;
  pin_generado_at: string | null;
  ultimo_ingreso_at: string | null;
  created_at: string;
}

const PIN = /^[A-Z]{3}[A-Z0-9]{4}$/;
/** Un usuario sin restricciones: estado propio y efectivo `activo`, sin motivo ni quién lo impuso. */
const SIN_ESTADO = {
  estado: 'activo',
  estado_efectivo: 'activo',
  estado_origen: null,
  estado_motivo: null,
  estado_desde: null,
  estado_impuesto_por: null,
};

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
  let contadorDeUnidades = 0;
  /** La unidad que acompaña a un Titular nuevo: un nombre distinto cada vez, en el sitio de A. */
  const unidad = () => ({ sitio_id: a.sitioId, nombre: `Casa ${(contadorDeUnidades += 1)}` });

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
        ...SIN_ESTADO,
        roles: [{ id: a.rolMiembroId, nombre: 'Miembro' }],
        unidad: null,
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
        unidad: unidad(),
        sufijo: 'c012',
      });
      expect(respuesta.statusCode, respuesta.body).toBe(201);
      expect(respuesta.json<{ pin: string }>().pin).toBe('AAAC012');
      expect((await ingresar('AAAC012')).statusCode).toBe(200);
      const repetido = await crear(sesionAdminA, {
        etiqueta: 'Otro',
        rol_ids: [a.rolTitularId],
        unidad: unidad(),
        sufijo: 'C012',
      });
      expect(repetido.statusCode).toBe(409);
    });

    it('crea un Titular con un PIN de 7 caracteres que entra, lo muestra una sola vez y lo cuelga de quien lo creó', async () => {
      const nueva = unidad();
      const respuesta = await crear(sesionAdminA, {
        etiqueta: '  Jorge Rivero ',
        rol_ids: [a.rolTitularId],
        unidad: nueva,
      });
      expect(respuesta.statusCode, respuesta.body).toBe(201);
      const creado = respuesta.json<UsuarioListado & { pin: string }>();
      expect(creado).toEqual({
        id: cualquierTexto(),
        etiqueta: 'Jorge Rivero',
        activo: true,
        ...SIN_ESTADO,
        roles: [{ id: a.rolTitularId, nombre: 'Titular' }],
        unidad: { id: cualquierTexto(), nombre: nueva.nombre, sitio_id: a.sitioId },
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
        (await crear(sesionAdminA, { etiqueta: 'T', rol_ids: [a.rolTitularId], unidad: unidad() }))
          .statusCode,
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
        unidad: unidad(),
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
        unidad: unidad(),
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
      const respuesta = await crear(sesionAdminA, {
        etiqueta: 'Nuevo',
        rol_ids: [a.rolTitularId],
        unidad: unidad(),
      });
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
        'accesos.qr.generar',
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
        (await crear(sesionAdminA, { etiqueta: '', rol_ids: [a.rolTitularId], unidad: unidad() }))
          .statusCode,
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
          unidad: unidad(),
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

    it('un Titular con Miembros no se da de baja sin confirmar: el 409 dice cuántos caen', async () => {
      const { titular, miembro } = await armarRamas();
      const respuesta = await eliminar(sesionAdminA, titular.id);
      expect(respuesta.statusCode).toBe(409);
      expect(respuesta.json()).toMatchObject({ code: 'usuario.con_dependientes', dependientes: 1 });
      // Nada cambió
      expect((await ingresar(titular.pin)).statusCode).toBe(200);
      expect((await ingresar(miembro.pin)).statusCode).toBe(200);
      expect(
        await contarFilas(prueba.pool, 'usuarios', 'id = ? AND deleted_at IS NULL', [miembro.id]),
      ).toBe(1);
    });

    it('con confirmación la baja es en cascada: cae el Titular, su unidad y sus Miembros, y se libera el cupo', async () => {
      const { titular, miembro, miembro2 } = await armarRamas();
      await prueba.pool.query(
        'INSERT INTO unidades (tenant_id, sitio_id, nombre, titular_id) VALUES (?, ?, ?, ?)',
        [a.cuenta.id, a.sitioId, 'Casa del titular', titular.id],
      );
      const sesionMiembro = await iniciarSesion(prueba.app, miembro.pin);
      const cupoAntes = await contarFilas(
        prueba.pool,
        'usuarios',
        'tenant_id = ? AND deleted_at IS NULL',
        [a.cuenta.id],
      );

      const respuesta = await prueba.app.inject({
        method: 'DELETE',
        url: `/api/v1/usuarios/${titular.id}?confirmar=true`,
        headers: conUsuario(sesionAdminA),
      });
      expect(respuesta.statusCode, respuesta.body).toBe(204);

      // Caen el Titular y su Miembro: no entran más y sus sesiones mueren
      expect((await ingresar(titular.pin)).statusCode).toBe(401);
      expect((await ingresar(miembro.pin)).statusCode).toBe(401);
      const conSesion = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/sesiones/actual',
        headers: conUsuario(sesionMiembro),
      });
      expect(conSesion.statusCode).toBe(401);
      // La unidad del Titular se da de baja con él
      expect(
        await contarFilas(prueba.pool, 'unidades', 'titular_id = ? AND deleted_at IS NOT NULL', [
          titular.id,
        ]),
      ).toBe(1);
      // Dos lugares liberados; la otra rama no se toca
      expect(
        await contarFilas(prueba.pool, 'usuarios', 'tenant_id = ? AND deleted_at IS NULL', [
          a.cuenta.id,
        ]),
      ).toBe(cupoAntes - 2);
      expect((await ingresar(miembro2.pin)).statusCode).toBe(200);
      // Cada baja queda en la bitácora
      expect(
        await contarFilas(
          prueba.pool,
          'bitacoras',
          "tabla = 'usuarios' AND accion = 'eliminado' AND registro_id IN (?, ?)",
          [titular.id, miembro.id],
        ),
      ).toBe(2);
    });

    it('un Titular con confirmación solo arrastra a su propia rama, no a la de otro Titular', async () => {
      const { titular, titular2, miembro2 } = await armarRamas();
      const sesionTitular = await iniciarSesion(prueba.app, titular.pin);
      // El Titular no puede dar de baja a otro Titular, ni siquiera confirmando
      const respuesta = await prueba.app.inject({
        method: 'DELETE',
        url: `/api/v1/usuarios/${titular2.id}?confirmar=true`,
        headers: conUsuario(sesionTitular),
      });
      expect(respuesta.statusCode).toBe(404);
      expect((await ingresar(miembro2.pin)).statusCode).toBe(200);
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
      const sitioId = await crearSitio(prueba.pool, cuenta, 'Sede');
      const nuevoTitular = (etiqueta: string, nombre: string) => ({
        etiqueta,
        rol_ids: [rolTitular],
        unidad: { sitio_id: sitioId, nombre },
      });
      const sesion = await iniciarSesion(prueba.app, admin.pin);
      const segundo = await crear(sesion, nuevoTitular('Segundo', 'Casa A'));
      expect(segundo.statusCode).toBe(201);
      expect((await crear(sesion, nuevoTitular('Tercero', 'Casa B'))).statusCode).toBe(422);
      expect((await eliminar(sesion, segundo.json<{ id: string }>().id)).statusCode).toBe(204);
      expect((await crear(sesion, nuevoTitular('Tercero', 'Casa B'))).statusCode).toBe(201);
    });
  });

  describe('unidades y tope de Miembros por Titular (ADR 0028)', () => {
    it('un Titular exige su unidad y los demás niveles no la admiten', async () => {
      const rolGuardia = await crearRol(prueba.pool, a.cuenta, 'Guardia', [
        'organizacion.puerta.ver',
      ]);
      const antes = await contarFilas(prueba.pool, 'usuarios', 'tenant_id = ?', [a.cuenta.id]);

      const sinUnidad = await crear(sesionAdminA, { etiqueta: 'T', rol_ids: [a.rolTitularId] });
      expect(sinUnidad.statusCode).toBe(422);
      expect(sinUnidad.json()).toMatchObject({ code: 'unidad.requerida' });
      const guardiaConUnidad = await crear(sesionAdminA, {
        etiqueta: 'G',
        rol_ids: [rolGuardia],
        unidad: unidad(),
      });
      expect(guardiaConUnidad.statusCode).toBe(422);
      expect(guardiaConUnidad.json()).toMatchObject({ code: 'unidad.no_corresponde' });

      expect(await contarFilas(prueba.pool, 'usuarios', 'tenant_id = ?', [a.cuenta.id])).toBe(
        antes,
      );
      expect((await crear(sesionAdminA, { etiqueta: 'G', rol_ids: [rolGuardia] })).statusCode).toBe(
        201,
      );
    });

    it('la unidad nace con su Titular y queda ligada a él', async () => {
      const nueva = unidad();
      const respuesta = await crear(sesionAdminA, {
        etiqueta: 'Titular',
        rol_ids: [a.rolTitularId],
        unidad: nueva,
      });
      expect(respuesta.statusCode, respuesta.body).toBe(201);
      const creado = respuesta.json<{ id: string }>();
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT tenant_id, sitio_id, nombre, titular_id FROM unidades WHERE titular_id = ?',
        [creado.id],
      );
      expect(filas).toHaveLength(1);
      expect(filas[0]).toMatchObject({
        tenant_id: a.cuenta.id,
        sitio_id: a.sitioId,
        nombre: nueva.nombre,
      });
      // El listado la muestra junto al Titular
      const lista = (await listar(sesionAdminA)).json<{ datos: UsuarioListado[] }>().datos;
      expect(lista.find((u) => u.id === creado.id)?.unidad).toMatchObject({ nombre: nueva.nombre });
    });

    it('un nombre repetido dentro de la propiedad es 409 y no deja un usuario a medias', async () => {
      const primera = unidad();
      expect(
        (await crear(sesionAdminA, { etiqueta: 'Uno', rol_ids: [a.rolTitularId], unidad: primera }))
          .statusCode,
      ).toBe(201);
      const antes = await contarFilas(prueba.pool, 'usuarios', 'tenant_id = ?', [a.cuenta.id]);

      const repetida = await crear(sesionAdminA, {
        etiqueta: 'Dos',
        rol_ids: [a.rolTitularId],
        unidad: primera,
      });
      expect(repetida.statusCode).toBe(409);
      expect(repetida.json()).toMatchObject({ code: 'unidad.nombre_existente' });
      expect(await contarFilas(prueba.pool, 'usuarios', 'tenant_id = ?', [a.cuenta.id])).toBe(
        antes,
      );

      // El mismo nombre en otra propiedad sí sirve
      const otroSitio = await crearSitio(prueba.pool, a.cuenta, 'Otro sitio');
      expect(
        (
          await crear(sesionAdminA, {
            etiqueta: 'Tres',
            rol_ids: [a.rolTitularId],
            unidad: { sitio_id: otroSitio, nombre: primera.nombre },
          })
        ).statusCode,
      ).toBe(201);
    });

    it('aislamiento: una propiedad de otra cuenta no existe (404) y no se crea nada', async () => {
      const antes = await contarFilas(prueba.pool, 'usuarios', 'tenant_id = ?', [a.cuenta.id]);
      const respuesta = await crear(sesionAdminA, {
        etiqueta: 'Intruso',
        rol_ids: [a.rolTitularId],
        unidad: { sitio_id: b.sitioId, nombre: 'Casa X' },
      });
      expect(respuesta.statusCode).toBe(404);
      expect(respuesta.json()).toMatchObject({ code: 'sitio.no_encontrado' });
      expect(await contarFilas(prueba.pool, 'usuarios', 'tenant_id = ?', [a.cuenta.id])).toBe(
        antes,
      );
      expect(await contarFilas(prueba.pool, 'unidades', 'tenant_id = ?', [b.cuenta.id])).toBe(0);
    });

    it('un Titular no pasa del tope de Miembros de la cuenta; otro Titular tiene su propio cupo', async () => {
      await prueba.pool.query('UPDATE cuentas SET max_miembros_por_titular = 2 WHERE id = ?', [
        a.cuenta.id,
      ]);
      const { titular, titular2 } = await armarRamas();
      const sesionTitular = await iniciarSesion(prueba.app, titular.pin);
      const sesionTitular2 = await iniciarSesion(prueba.app, titular2.pin);
      const nuevoMiembro = (sesion: Sesion, etiqueta: string) =>
        crear(sesion, { etiqueta, rol_ids: [a.rolMiembroId] });

      // `armarRamas` ya dejó un Miembro debajo de cada Titular: entra uno más y no un tercero
      expect((await nuevoMiembro(sesionTitular, 'Segundo')).statusCode).toBe(201);
      const excedido = await nuevoMiembro(sesionTitular, 'Tercero');
      expect(excedido.statusCode).toBe(422);
      expect(excedido.json()).toMatchObject({
        code: 'plan.limite_miembros_por_titular',
        maximo: 2,
      });
      expect((await nuevoMiembro(sesionTitular2, 'Del otro')).statusCode).toBe(201);

      // Dar de baja a uno libera el lugar
      const hijos = (await listar(sesionTitular)).json<{ datos: UsuarioListado[] }>().datos;
      expect((await eliminar(sesionTitular, hijos[0]?.id ?? '')).statusCode).toBe(204);
      expect((await nuevoMiembro(sesionTitular, 'Tercero')).statusCode).toBe(201);
    });

    it('el tope por defecto de una cuenta es 10', async () => {
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT max_miembros_por_titular AS tope FROM cuentas WHERE id = ?',
        [a.cuenta.id],
      );
      expect(Number(filas[0]?.tope)).toBe(10);
    });
  });

  describe('GET /api/v1/cupo (ADR 0028 §6)', () => {
    const cupo = (sesion: Sesion) =>
      prueba.app.inject({ method: 'GET', url: '/api/v1/cupo', headers: conUsuario(sesion) });

    it('muestra el uso del cupo de toda la cuenta y avisa al 80 % y al 100 %', async () => {
      await armarRamas(); // 2 + 5 usuarios = 7 vigentes
      const usados = await contarFilas(
        prueba.pool,
        'usuarios',
        'tenant_id = ? AND deleted_at IS NULL',
        [a.cuenta.id],
      );
      const fijarMaximo = (maximo: number | null) =>
        prueba.pool.query('UPDATE planes SET max_usuarios = ?', [maximo]);

      await fijarMaximo(14);
      expect((await cupo(sesionAdminA)).json()).toEqual({
        usados,
        maximo: 14,
        porcentaje: 50,
        aviso: null,
        max_miembros_por_titular: 10,
      });
      await fijarMaximo(9);
      expect((await cupo(sesionAdminA)).json()).toMatchObject({ porcentaje: 77, aviso: null });
      await fijarMaximo(8);
      expect((await cupo(sesionAdminA)).json()).toMatchObject({
        porcentaje: 87,
        aviso: 'cerca_del_limite',
      });
      await fijarMaximo(usados);
      expect((await cupo(sesionAdminA)).json()).toMatchObject({
        porcentaje: 100,
        aviso: 'limite_alcanzado',
      });
      await fijarMaximo(null);
      expect((await cupo(sesionAdminA)).json()).toMatchObject({
        maximo: null,
        porcentaje: null,
        aviso: null,
      });
    });

    it('cada Administrador ve el total de la cuenta, no solo el de su rama', async () => {
      const { admin2 } = await armarRamas();
      const sesionAdmin2 = await iniciarSesion(prueba.app, admin2.pin);
      const deUno = (await cupo(sesionAdminA)).json<{ usados: number }>().usados;
      const deOtro = (await cupo(sesionAdmin2)).json<{ usados: number }>().usados;
      expect(deOtro).toBe(deUno);
      expect(deUno).toBe(
        await contarFilas(prueba.pool, 'usuarios', 'tenant_id = ? AND deleted_at IS NULL', [
          a.cuenta.id,
        ]),
      );
    });

    it('solo el Administrador lo ve: ni un Titular ni un Miembro', async () => {
      const { titular } = await armarRamas();
      const sesionTitular = await iniciarSesion(prueba.app, titular.pin);
      const sesionMiembro = await iniciarSesion(prueba.app, a.usuario.pin);
      expect((await cupo(sesionTitular)).statusCode).toBe(403);
      expect((await cupo(sesionMiembro)).statusCode).toBe(403);
    });

    it('aislamiento: cada cuenta ve solo sus usuarios y su propio tope', async () => {
      await prueba.pool.query('UPDATE cuentas SET max_miembros_por_titular = 3 WHERE id = ?', [
        b.cuenta.id,
      ]);
      const deA = (await cupo(sesionAdminA)).json<{
        usados: number;
        max_miembros_por_titular: number;
      }>();
      const deB = (await cupo(sesionAdminB)).json<{
        usados: number;
        max_miembros_por_titular: number;
      }>();
      expect(deA).toMatchObject({ usados: 2, max_miembros_por_titular: 10 });
      expect(deB).toMatchObject({ usados: 2, max_miembros_por_titular: 3 });
    });
  });

  describe('POST /api/v1/usuarios/:id/pin/compartido (ADR 0028 §7)', () => {
    const compartido = (sesion: Sesion, id: string) =>
      prueba.app.inject({
        method: 'POST',
        url: `/api/v1/usuarios/${id}/pin/compartido`,
        headers: conUsuario(sesion),
      });
    const eventos = async (usuarioId: string) => {
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT usuario_id, accion, antes, despues FROM bitacoras WHERE tabla = 'usuarios' AND registro_id = ? AND accion = 'actualizado' ORDER BY id",
        [usuarioId],
      );
      return filas;
    };

    it('registra el envío en la bitácora con quién lo hizo, sin tocar el PIN', async () => {
      const respuesta = await compartido(sesionAdminA, a.usuario.id);
      expect(respuesta.statusCode, respuesta.body).toBe(204);

      const filas = await eventos(a.usuario.id);
      expect(filas).toHaveLength(1);
      expect(String(filas[0]?.usuario_id)).toBe(a.administrador.id);
      expect(JSON.stringify(filas[0]?.despues)).toContain('pin_compartido_at');
      // Ni el PIN ni su hash: solo la fecha
      expect(JSON.stringify(filas[0])).not.toContain('pin_hash');
      expect(JSON.stringify(filas[0])).not.toContain(a.usuario.pin);
      // El PIN sigue sirviendo: compartirlo no lo cambia ni obliga a cambiarlo
      expect((await ingresar(a.usuario.pin)).statusCode).toBe(200);
    });

    it('cada envío queda registrado, también el repetido', async () => {
      await compartido(sesionAdminA, a.usuario.id);
      await compartido(sesionAdminA, a.usuario.id);
      expect(await eventos(a.usuario.id)).toHaveLength(2);
    });

    it('el Titular lo registra para sus Miembros', async () => {
      const { titular, miembro } = await armarRamas();
      const sesionTitular = await iniciarSesion(prueba.app, titular.pin);
      expect((await compartido(sesionTitular, miembro.id)).statusCode).toBe(204);
      const filas = await eventos(miembro.id);
      expect(String(filas[0]?.usuario_id)).toBe(titular.id);
    });

    it('ramas: no se registra para un igual, un superior, uno de otra rama ni el propio actor (404)', async () => {
      const { titular, miembro2, admin2 } = await armarRamas();
      const sesionTitular = await iniciarSesion(prueba.app, titular.pin);
      expect((await compartido(sesionAdminA, miembro2.id)).statusCode).toBe(404);
      expect((await compartido(sesionAdminA, admin2.id)).statusCode).toBe(404);
      expect((await compartido(sesionAdminA, a.administrador.id)).statusCode).toBe(404);
      expect((await compartido(sesionTitular, a.administrador.id)).statusCode).toBe(404);
      expect(await eventos(miembro2.id)).toHaveLength(0);
    });

    it('aislamiento: un usuario de otra cuenta no existe (404) y nada se registra', async () => {
      expect((await compartido(sesionAdminA, b.usuario.id)).statusCode).toBe(404);
      expect(await eventos(b.usuario.id)).toHaveLength(0);
    });

    it('exige seguridad.usuario.editar y sesión', async () => {
      const sesionMiembro = await iniciarSesion(prueba.app, a.usuario.pin);
      expect((await compartido(sesionMiembro, a.usuario.id)).statusCode).toBe(403);
      const sinSesion = await prueba.app.inject({
        method: 'POST',
        url: `/api/v1/usuarios/${a.usuario.id}/pin/compartido`,
      });
      expect(sinSesion.statusCode).toBe(401);
    });
  });
});
