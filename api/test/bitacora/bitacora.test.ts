import type { RowDataPacket } from 'mysql2/promise';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { crearEscenario, crearSuperAdmin } from '../helpers/fixtures.js';
import {
  conUsuario,
  iniciarSesion,
  iniciarSesionDePlataforma,
  respaldoDePago,
} from '../helpers/http.js';

const BASE = '/api/v1/plataforma';
const DIA = 86_400_000;

interface EventoDto {
  codigo: string;
  accion: string;
  origen: string;
  usuario: { nombre: string } | null;
  cuenta: { codigo: string } | null;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
}

describe('plataforma: bitácora y resumen (A10, A05d, A02)', () => {
  let prueba: AppDePrueba;
  let headers: { authorization: string };
  let planes: Record<100 | 200 | 350, string>;

  beforeEach(async () => {
    prueba = await crearAppDePrueba();
    await reiniciarBase(prueba.pool);
    const lucia = await crearSuperAdmin(prueba.pool, 'lucia.paz', { nombre: 'Lucía Paz' });
    headers = conUsuario(
      await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', lucia.contrasena),
    );
    const lista = (
      await prueba.app.inject({ method: 'GET', url: `${BASE}/planes`, headers })
    ).json<{
      datos: { id: string; cupo_usuarios: number }[];
    }>().datos;
    planes = Object.fromEntries(lista.map((p) => [p.cupo_usuarios, p.id])) as Record<
      100 | 200 | 350,
      string
    >;
  });
  afterEach(async () => {
    await prueba.cerrar();
  });

  const post = (url: string, payload: object = {}) =>
    prueba.app.inject({ method: 'POST', url: `${BASE}${url}`, headers, payload });
  const bitacora = async (query: Record<string, string> = {}) =>
    (await prueba.app.inject({ method: 'GET', url: `${BASE}/bitacora`, headers, query })).json<{
      datos: EventoDto[];
      meta: { total: number };
    }>();

  async function crearCuentaPorApi(codigo: string, razon = `Empresa ${codigo}`) {
    const respuesta = await post('/cuentas', {
      razon_social: razon,
      codigo,
      nit: '1020304050',
      ciudad: 'Montero',
      contacto_nombre: 'Luis Soria',
      contacto_telefono: '3 922 0011',
      plan_id: planes[100],
      inicio: '2026-10-12',
      administrador_nombre: `Admin ${codigo}`,
      pago: { monto: 12_000, fecha_pago: '2026-10-12', medio: 'efectivo', referencia: 'R-1' },
    });
    expect(respuesta.statusCode, respuesta.body).toBe(201);
    return respuesta.json<{ cuenta: { id: string } }>().cuenta.id;
  }

  it('cuenta la historia de una cuenta: alta, pago, mejora de plan y suspensión, con quién y qué cuenta', async () => {
    const id = await crearCuentaPorApi('FRO', 'Frigorífico Oriente');
    await post(`/cuentas/${id}/pagos`, {
      tipo: 'renovacion',
      monto: 12000,
      fecha_pago: '2026-10-12',
      medio: 'transferencia',
      referencia: 'TRF-1',
      ...(await respaldoDePago(prueba.app, headers)),
    });
    await prueba.app.inject({
      method: 'PUT',
      url: `${BASE}/cuentas/${id}/suscripcion/plan`,
      headers,
      payload: { plan_id: planes[200] },
    });
    await post(`/cuentas/${id}/suscripcion/suspension`);

    const { datos } = await bitacora({ cuenta_id: id });
    const codigos = datos.map((e) => e.codigo);
    // El más reciente primero.
    expect(codigos.slice(0, 4)).toEqual([
      'suscripcion.suspendida',
      'suscripcion.plan_cambiado',
      'pago.registrado',
      'suscripcion.renovada',
    ]);
    expect(codigos).toContain('cuenta.creada');
    expect(codigos).toContain('usuario.creado');
    const mejora = datos.find((e) => e.codigo === 'suscripcion.plan_cambiado');
    expect(mejora).toMatchObject({
      usuario: { nombre: 'Lucía Paz' },
      cuenta: { codigo: 'FRO' },
      origen: 'api',
      canal: 'panel',
      antes: { plan: '100 usuarios' },
      despues: { plan: '200 usuarios' },
    });
    expect(datos.find((e) => e.codigo === 'pago.registrado')?.despues).toMatchObject({
      monto: 12000,
      referencia: 'TRF-1',
    });
  });

  it('no registra detalles internos del alta ni hashes ni PIN', async () => {
    const id = await crearCuentaPorApi('FRO');
    const cuerpo = JSON.stringify(await bitacora({ cuenta_id: id }));
    expect(cuerpo).not.toContain('pin_hash');
    expect(cuerpo).not.toContain('contrasena_hash');
    expect(cuerpo).not.toContain('pin_indice');
    const { datos } = await bitacora({ cuenta_id: id });
    expect(datos.map((e) => e.codigo)).not.toContain('rol.creado');
  });

  it('los cambios de plataforma (precio, equipo) salen sin cuenta', async () => {
    const [plan] = (
      await prueba.app.inject({ method: 'GET', url: `${BASE}/planes`, headers })
    ).json<{
      datos: { id: string }[];
    }>().datos;
    await prueba.app.inject({
      method: 'PUT',
      url: `${BASE}/planes/precios`,
      headers,
      payload: { precios: [{ plan_id: plan?.id, precio_anual: 13000 }] },
    });
    await post('/equipo', {
      nombre: 'Marco',
      usuario: 'marco.suarez',
      contrasena_temporal: 'temporal-12345',
    });
    const { datos } = await bitacora();
    const precio = datos.find((e) => e.codigo === 'plan.precio_editado');
    expect(precio).toMatchObject({
      cuenta: null,
      despues: { plan: '100 usuarios', precio_anual: 13000 },
    });
    expect(datos.find((e) => e.codigo === 'equipo.agregado')?.despues).toMatchObject({
      username: 'marco.suarez',
    });
  });

  it('filtra por cuenta, por acción y por fecha, y pagina', async () => {
    const a = await crearCuentaPorApi('AAA');
    const b = await crearCuentaPorApi('BBB');
    await post(`/cuentas/${a}/suscripcion/suspension`);
    expect((await bitacora({ cuenta_id: b })).datos.every((e) => e.cuenta?.codigo === 'BBB')).toBe(
      true,
    );
    const editados = await bitacora({ accion: 'actualizado' });
    expect(editados.datos.length).toBeGreaterThan(0);
    expect(editados.datos.every((e) => e.accion === 'actualizado')).toBe(true);

    // El filtro cuenta los días en la zona de La Paz (UTC-4): con toISOString() el test
    // fallaba entre las 20:00 y las 24:00 locales, cuando en UTC ya es el día siguiente.
    const diaEnLaPaz = (ms: number): string =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz' }).format(new Date(ms));
    const hoy = diaEnLaPaz(Date.now());
    const futuro = diaEnLaPaz(Date.now() + 3 * DIA);
    expect((await bitacora({ desde: hoy, hasta: hoy })).meta.total).toBeGreaterThan(0);
    expect((await bitacora({ desde: futuro })).meta.total).toBe(0);

    const total = (await bitacora()).meta.total;
    const pagina = await bitacora({ por_pagina: '2', pagina: '2' });
    expect(pagina.datos).toHaveLength(2);
    expect(pagina.meta.total).toBe(total);
  });

  it('un usuario de una cuenta no ve la bitácora de la plataforma', async () => {
    const escenario = await crearEscenario(prueba.pool, 'ZZZ');
    const sesion = await iniciarSesion(prueba.app, escenario.administrador.pin);
    const respuesta = await prueba.app.inject({
      method: 'GET',
      url: `${BASE}/bitacora`,
      headers: conUsuario(sesion),
    });
    expect(respuesta.statusCode).toBe(401);
    expect(
      (
        await prueba.app.inject({
          method: 'GET',
          url: `${BASE}/resumen`,
          headers: conUsuario(sesion),
        })
      ).statusCode,
    ).toBe(401);
  });

  describe('resumen', () => {
    const resumen = async () =>
      (await prueba.app.inject({ method: 'GET', url: `${BASE}/resumen`, headers })).json<{
        cuentas: { activas: number; total: number; por_vencer: number };
        usuarios: { en_uso: number; cupo_vendido: number };
        por_vencer_30: { cuentas: number; monto: number };
        ingresos_esperados: { monto: number };
        renovaciones: { cuenta: { codigo: string }; dias_restantes: number; estado: string }[];
        ultimas_acciones: unknown[];
      }>();

    async function conVencimiento(codigo: string, dias: number, plan: string) {
      const id = await crearCuentaPorApi(codigo);
      const hasta = new Date(Date.now() + dias * DIA);
      await prueba.pool.query(
        'UPDATE suscripciones SET plan_id = ?, desde = ?, hasta = ? WHERE tenant_id = ?',
        [plan, new Date(hasta.getTime() - 365 * DIA), hasta, id],
      );
      return id;
    }

    it('cuenta cuentas, usuarios, cupo vendido, lo que vence en 30 días y lo esperado', async () => {
      await conVencimiento('AAA', 100, planes[200]);
      await conVencimiento('BBB', 10, planes[100]);
      await conVencimiento('CCC', -5, planes[350]);
      const suspendida = await conVencimiento('DDD', 200, planes[100]);
      await post(`/cuentas/${suspendida}/suscripcion/suspension`);

      const r = await resumen();
      expect(r.cuentas).toEqual({ activas: 2, total: 4, por_vencer: 1 });
      expect(r.usuarios).toEqual({ en_uso: 2, cupo_vendido: 300 });
      expect(r.por_vencer_30).toEqual({ cuentas: 1, monto: 12000 });
      expect(r.ingresos_esperados.monto).toBe(21600 + 12000);
    });

    it('lista las renovaciones próximas y la última vencida, y las últimas acciones', async () => {
      await conVencimiento('AAA', 6, planes[100]);
      await conVencimiento('BBB', 24, planes[100]);
      await conVencimiento('CCC', -10, planes[100]);
      const r = await resumen();
      expect(r.renovaciones.map((x) => [x.cuenta.codigo, x.estado])).toEqual([
        ['AAA', 'por_vencer'],
        ['BBB', 'por_vencer'],
        ['CCC', 'vencida'],
      ]);
      expect(r.ultimas_acciones).toHaveLength(5);
    });

    it('sin cuentas, todo en cero', async () => {
      const r = await resumen();
      expect(r.cuentas).toEqual({ activas: 0, total: 0, por_vencer: 0 });
      expect(r.renovaciones).toEqual([]);
    });
  });

  it('la bitácora de solo inserción: ninguna ruta la modifica', async () => {
    await crearCuentaPorApi('AAA');
    const [filas] = await prueba.pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM bitacoras');
    for (const metodo of ['PUT', 'PATCH', 'DELETE'] as const) {
      const respuesta = await prueba.app.inject({
        method: metodo,
        url: `${BASE}/bitacora/1`,
        headers,
      });
      expect(respuesta.statusCode).toBe(404);
    }
    const [despues] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS n FROM bitacoras',
    );
    expect(despues[0]?.n).toBe(filas[0]?.n);
  });
});
