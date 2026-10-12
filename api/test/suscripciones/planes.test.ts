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
