import type { RowDataPacket } from 'mysql2/promise';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { crearCuenta, crearEscenario, crearSuperAdmin } from '../helpers/fixtures.js';
import {
  conUsuario,
  iniciarSesion,
  iniciarSesionDePlataforma,
  type Problema,
} from '../helpers/http.js';

const RUTA = '/api/v1/plataforma/planes';

interface PlanDto {
  id: string;
  nombre: string;
  cupo_usuarios: number;
  precio_anual: number;
  cuentas: number;
  usuarios_en_uso: number;
}

describe('plataforma: planes (A09)', () => {
  let prueba: AppDePrueba;
  let headers: { authorization: string };

  beforeEach(async () => {
    prueba = await crearAppDePrueba();
    await reiniciarBase(prueba.pool);
    const admin = await crearSuperAdmin(prueba.pool, 'lucia.paz');
    headers = conUsuario(
      await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', admin.contrasena),
    );
  });
  afterEach(async () => {
    await prueba.cerrar();
  });

  const planes = async () => {
    const respuesta = await prueba.app.inject({ method: 'GET', url: RUTA, headers });
    expect(respuesta.statusCode, respuesta.body).toBe(200);
    return respuesta.json<{ datos: PlanDto[] }>().datos;
  };

  it('el catálogo trae los tres planes anuales por cupo, del más chico al más grande', async () => {
    const lista = await planes();
    expect(lista.map((p) => [p.nombre, p.cupo_usuarios, p.precio_anual])).toEqual([
      ['100 usuarios', 100, 12000],
      ['200 usuarios', 200, 21600],
      ['350 usuarios', 350, 33600],
    ]);
  });

  it('cuenta las cuentas de cada plan y sus usuarios activos', async () => {
    const plan100 = (await planes()).find((p) => p.cupo_usuarios === 100);
    const a = await crearEscenario(prueba.pool, 'AAA');
    const b = await crearCuenta(prueba.pool, 'BBB');
    // `crearEscenario` ya le dio a A una suscripción: se pasa al plan de 100 usuarios.
    await prueba.pool.query('UPDATE suscripciones SET plan_id = ? WHERE tenant_id = ?', [
      plan100?.id,
      a.cuenta.id,
    ]);
    await prueba.pool.query(
      "INSERT INTO suscripciones (tenant_id, plan_id, desde, hasta, estado) VALUES (?, ?, '2026-01-01', '2027-01-01', 'vigente')",
      [b.id, plan100?.id],
    );
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS n FROM usuarios WHERE tenant_id = ? AND activo = 1',
      [a.cuenta.id],
    );
    const lista = await planes();
    expect(lista.find((p) => p.cupo_usuarios === 100)).toMatchObject({
      cuentas: 2,
      usuarios_en_uso: Number(filas[0]?.n),
    });
    expect(lista.find((p) => p.cupo_usuarios === 200)).toMatchObject({
      cuentas: 0,
      usuarios_en_uso: 0,
    });
  });

  it('guarda los precios de varios planes de una vez y deja el rastro en la bitácora', async () => {
    const lista = await planes();
    const respuesta = await prueba.app.inject({
      method: 'PUT',
      url: `${RUTA}/precios`,
      headers,
      payload: {
        precios: [
          { plan_id: lista[0]?.id, precio_anual: 13000 },
          { plan_id: lista[1]?.id, precio_anual: 22000.5 },
        ],
      },
    });
    expect(respuesta.statusCode, respuesta.body).toBe(204);
    expect((await planes()).map((p) => p.precio_anual)).toEqual([13000, 22000.5, 33600]);
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      "SELECT id FROM bitacoras WHERE tabla = 'planes' AND accion = 'actualizado'",
    );
    expect(filas).toHaveLength(2);
  });

  it('es todo o nada: un plan inexistente no cambia ningún precio', async () => {
    const lista = await planes();
    const respuesta = await prueba.app.inject({
      method: 'PUT',
      url: `${RUTA}/precios`,
      headers,
      payload: {
        precios: [
          { plan_id: lista[0]?.id, precio_anual: 1 },
          { plan_id: '999999', precio_anual: 1 },
        ],
      },
    });
    expect(respuesta.statusCode).toBe(404);
    expect(respuesta.json<Problema>().code).toBe('plan.no_encontrado');
    expect((await planes())[0]?.precio_anual).toBe(12000);
  });

  it('rechaza precios negativos o con más de 2 decimales', async () => {
    const lista = await planes();
    for (const precio_anual of [-1, 10.123]) {
      const respuesta = await prueba.app.inject({
        method: 'PUT',
        url: `${RUTA}/precios`,
        headers,
        payload: { precios: [{ plan_id: lista[0]?.id, precio_anual }] },
      });
      expect(respuesta.statusCode).toBe(400);
    }
  });

  it('un usuario de una cuenta no ve ni cambia los planes de la plataforma', async () => {
    const escenario = await crearEscenario(prueba.pool, 'CCC');
    const sesion = await iniciarSesion(prueba.app, escenario.administrador.pin);
    const lectura = await prueba.app.inject({
      method: 'GET',
      url: RUTA,
      headers: conUsuario(sesion),
    });
    const escritura = await prueba.app.inject({
      method: 'PUT',
      url: `${RUTA}/precios`,
      headers: conUsuario(sesion),
      payload: { precios: [{ plan_id: '1', precio_anual: 1 }] },
    });
    expect(lectura.statusCode).toBe(401);
    expect(escritura.statusCode).toBe(401);
  });

  it('sin el permiso de plataforma, 403', async () => {
    await prueba.pool.query(
      "DELETE rp FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id WHERE p.codigo = 'suscripciones.plan.ver'",
    );
    const nueva = await iniciarSesionDePlataforma(
      prueba.app,
      'lucia.paz',
      'contrasena-de-prueba-1',
    );
    const respuesta = await prueba.app.inject({
      method: 'GET',
      url: RUTA,
      headers: conUsuario(nueva),
    });
    expect(respuesta.statusCode).toBe(403);
  });
});

describe('plataforma: gestión de planes (crear, editar, retirar)', () => {
  let prueba: AppDePrueba;
  let headers: { authorization: string };

  beforeEach(async () => {
    prueba = await crearAppDePrueba();
    await reiniciarBase(prueba.pool);
    const admin = await crearSuperAdmin(prueba.pool, 'lucia.paz');
    headers = conUsuario(
      await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', admin.contrasena),
    );
  });
  afterEach(async () => {
    await prueba.cerrar();
  });

  const crear = (cuerpo: Record<string, unknown>) =>
    prueba.app.inject({ method: 'POST', url: RUTA, headers, payload: cuerpo });
  const nuevoPlan = { nombre: '500 usuarios', cupo_usuarios: 500, precio_anual: 45000 };
  const lista = async () =>
    (await prueba.app.inject({ method: 'GET', url: RUTA, headers })).json<{ datos: PlanDto[] }>()
      .datos;
  const idDe = async (cupo: number) => (await lista()).find((p) => p.cupo_usuarios === cupo)?.id;

  it('crea un plan que aparece de inmediato entre los que se asignan', async () => {
    const respuesta = await crear(nuevoPlan);
    expect(respuesta.statusCode, respuesta.body).toBe(201);
    const plan = (await lista()).find((p) => p.nombre === '500 usuarios');
    expect(plan).toMatchObject({ cupo_usuarios: 500, precio_anual: 45000, cuentas: 0 });
  });

  it('rechaza un nombre repetido y datos inválidos', async () => {
    await crear(nuevoPlan);
    expect((await crear(nuevoPlan)).json<Problema>().code).toBe('plan.nombre_existente');
    for (const cambio of [
      { nombre: ' ' },
      { cupo_usuarios: 0 },
      { cupo_usuarios: 1.5 },
      { precio_anual: -1 },
    ]) {
      expect((await crear({ ...nuevoPlan, nombre: 'Otro', ...cambio })).statusCode).toBe(400);
    }
  });

  it('edita el nombre y el precio de un plan en uso, pero no su cupo', async () => {
    const id = await idDe(100);
    const cuenta = await crearEscenario(prueba.pool, 'AAA');
    await prueba.pool.query('UPDATE suscripciones SET plan_id = ? WHERE tenant_id = ?', [
      id,
      cuenta.cuenta.id,
    ]);
    const editar = (cuerpo: Record<string, unknown>) =>
      prueba.app.inject({ method: 'PATCH', url: `${RUTA}/${id ?? ''}`, headers, payload: cuerpo });
    expect((await editar({ nombre: 'Básico', precio_anual: 12500 })).statusCode).toBe(204);
    expect((await lista()).find((p) => p.id === id)).toMatchObject({
      nombre: 'Básico',
      precio_anual: 12500,
    });
    const cupo = await editar({ cupo_usuarios: 150 });
    expect(cupo.statusCode).toBe(422);
    expect(cupo.json<Problema>().code).toBe('plan.en_uso');
  });

  it('el cupo sí se edita mientras ninguna cuenta use el plan', async () => {
    const id = await idDe(350);
    const respuesta = await prueba.app.inject({
      method: 'PATCH',
      url: `${RUTA}/${id ?? ''}`,
      headers,
      payload: { cupo_usuarios: 400, nombre: '400 usuarios' },
    });
    expect(respuesta.statusCode, respuesta.body).toBe(204);
    expect((await lista()).find((p) => p.id === id)).toMatchObject({ cupo_usuarios: 400 });
  });

  it('no deja renombrar a un nombre que ya existe ni editar un plan inexistente', async () => {
    const id = await idDe(200);
    const repetido = await prueba.app.inject({
      method: 'PATCH',
      url: `${RUTA}/${id ?? ''}`,
      headers,
      payload: { nombre: '100 usuarios' },
    });
    expect(repetido.json<Problema>().code).toBe('plan.nombre_existente');
    const inexistente = await prueba.app.inject({
      method: 'PATCH',
      url: `${RUTA}/999999`,
      headers,
      payload: { nombre: 'X' },
    });
    expect(inexistente.statusCode).toBe(404);
  });

  it('eliminar un plan que nadie usó lo borra de forma lógica', async () => {
    const id = await idDe(350);
    const respuesta = await prueba.app.inject({
      method: 'DELETE',
      url: `${RUTA}/${id ?? ''}`,
      headers,
    });
    expect(respuesta.json()).toEqual({ resultado: 'eliminado' });
    expect((await lista()).some((p) => p.id === id)).toBe(false);
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT deleted_at, deleted_by FROM planes WHERE id = ?',
      [id],
    );
    expect(filas[0]?.deleted_at).not.toBeNull();
    expect(filas[0]?.deleted_by).not.toBeNull();
  });

  describe('un plan retirado con cuentas', () => {
    let id: string | undefined;
    let escenario: Awaited<ReturnType<typeof crearEscenario>>;

    beforeEach(async () => {
      id = await idDe(100);
      escenario = await crearEscenario(prueba.pool, 'AAA');
      await prueba.pool.query('UPDATE suscripciones SET plan_id = ? WHERE tenant_id = ?', [
        id,
        escenario.cuenta.id,
      ]);
    });

    it('deja de ofrecerse, pero sigue valiendo para la cuenta que ya lo tiene', async () => {
      const respuesta = await prueba.app.inject({
        method: 'DELETE',
        url: `${RUTA}/${id ?? ''}`,
        headers,
      });
      expect(respuesta.json()).toEqual({ resultado: 'retirado' });
      expect((await lista()).some((p) => p.id === id)).toBe(false);

      const sesion = await iniciarSesion(prueba.app, escenario.usuario.pin);
      const emitir = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/qr-accesos',
        headers: conUsuario(sesion),
        payload: { puerta_ids: [escenario.puertaPrincipal.id] },
      });
      expect(emitir.statusCode, emitir.body).toBe(201);
      const detalle = await prueba.app.inject({
        method: 'GET',
        url: `/api/v1/plataforma/cuentas/${escenario.cuenta.id}/suscripcion`,
        headers,
      });
      expect(
        detalle.json<{ suscripcion: { plan: { nombre: string } } }>().suscripcion.plan.nombre,
      ).toBe('100 usuarios');
    });

    it('no se puede asignar a una cuenta nueva ni como mejora', async () => {
      await prueba.app.inject({ method: 'DELETE', url: `${RUTA}/${id ?? ''}`, headers });
      const alta = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/plataforma/cuentas',
        headers,
        payload: {
          razon_social: 'Nueva S.A.',
          codigo: 'NUE',
          nit: '1234567',
          ciudad: 'Montero',
          contacto_nombre: 'X',
          contacto_telefono: '3 922 0011',
          plan_id: id,
          inicio: '2026-10-12',
          administrador_nombre: 'Admin',
        },
      });
      expect(alta.statusCode).toBe(404);
      expect(alta.json<Problema>().code).toBe('plan.no_encontrado');
    });

    it('deja el rastro en la bitácora', async () => {
      await crear(nuevoPlan);
      await prueba.app.inject({ method: 'DELETE', url: `${RUTA}/${id ?? ''}`, headers });
      const bitacora = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/plataforma/bitacora',
        headers,
      });
      const codigos = bitacora.json<{ datos: { codigo: string }[] }>().datos.map((e) => e.codigo);
      expect(codigos).toContain('plan.creado');
      expect(codigos).toContain('plan.eliminado');
    });
  });

  it('un usuario de una cuenta no puede crear, editar ni retirar planes', async () => {
    const escenario = await crearEscenario(prueba.pool, 'ZZZ');
    const sesion = conUsuario(await iniciarSesion(prueba.app, escenario.administrador.pin));
    for (const peticion of [
      { method: 'POST', url: RUTA },
      { method: 'PATCH', url: `${RUTA}/1` },
      { method: 'DELETE', url: `${RUTA}/1` },
    ] as const) {
      const respuesta = await prueba.app.inject({ ...peticion, headers: sesion, payload: {} });
      expect(respuesta.statusCode).toBe(401);
    }
  });
});
