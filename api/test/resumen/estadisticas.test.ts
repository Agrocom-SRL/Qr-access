import type { ResultSetHeader } from 'mysql2/promise';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { crearEscenario, crearSuperAdmin, type Escenario } from '../helpers/fixtures.js';
import { conUsuario, iniciarSesionDePlataforma } from '../helpers/http.js';

interface Estadisticas {
  cobrado_por_mes: { mes: string; monto: number; pagos: number }[];
  altas_por_mes: { mes: string; cuentas: number }[];
  cuentas_por_estado: Record<string, number>;
  cuentas_por_plan: { plan: string; cuentas: number }[];
  accesos_por_dia: {
    dia: string;
    permitidos: number;
    rechazados: number;
    repeticiones_permitidas: number;
    repeticiones_rechazadas: number;
  }[];
}

const hoyLocal = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', dateStyle: 'short' }).format(
    new Date(),
  );

describe('plataforma: estadísticas del panel (A02, A08)', () => {
  let prueba: AppDePrueba;
  let headers: { authorization: string };
  let a: Escenario;

  beforeEach(async () => {
    prueba = await crearAppDePrueba();
    await reiniciarBase(prueba.pool);
    const lucia = await crearSuperAdmin(prueba.pool, 'lucia.paz');
    headers = conUsuario(
      await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', lucia.contrasena),
    );
    a = await crearEscenario(prueba.pool, 'AAA');
    await crearEscenario(prueba.pool, 'BBB');
  });
  afterEach(async () => {
    await prueba.cerrar();
  });

  const pedir = async () => {
    const respuesta = await prueba.app.inject({
      method: 'GET',
      url: '/api/v1/plataforma/estadisticas',
      headers,
    });
    expect(respuesta.statusCode, respuesta.body).toBe(200);
    return respuesta.json<Estadisticas>();
  };

  it('devuelve 12 meses y 14 días completos, con ceros donde no pasó nada', async () => {
    const estadisticas = await pedir();
    expect(estadisticas.cobrado_por_mes).toHaveLength(12);
    expect(estadisticas.altas_por_mes).toHaveLength(12);
    expect(estadisticas.accesos_por_dia).toHaveLength(14);
    expect(estadisticas.accesos_por_dia.at(-1)?.dia).toBe(hoyLocal());
    expect(estadisticas.cobrado_por_mes.every((mes) => mes.monto === 0)).toBe(true);
  });

  it('cuenta las cuentas por estado y por plan', async () => {
    const estadisticas = await pedir();
    const estados = estadisticas.cuentas_por_estado;
    // Las cuentas de prueba vencen pronto: cuentan como "por vencer".
    expect((estados.activa ?? 0) + (estados.por_vencer ?? 0)).toBe(2);
    expect(estados.pendiente_pago).toBe(0);
    expect(estadisticas.cuentas_por_plan.reduce((suma, p) => suma + p.cuentas, 0)).toBe(2);
    expect(estadisticas.altas_por_mes.at(-1)?.cuentas).toBe(2);
  });

  it('suma lo cobrado en el mes del pago', async () => {
    await prueba.app.inject({
      method: 'POST',
      url: `/api/v1/plataforma/cuentas/${a.cuenta.id}/pagos`,
      headers,
      payload: {
        tipo: 'renovacion',
        monto: 12_000,
        fecha_pago: hoyLocal(),
        medio: 'efectivo',
        referencia: 'R-1',
      },
    });
    const ultimo = (await pedir()).cobrado_por_mes.at(-1);
    expect(ultimo).toMatchObject({ mes: hoyLocal().slice(0, 7), monto: 12_000, pagos: 1 });
  });

  it('suma los intentos de acceso de hoy de todas las cuentas, permitidos y rechazados', async () => {
    for (const resultado of ['permitido', 'permitido', 'rechazado']) {
      await prueba.pool.query(
        'INSERT INTO lecturas (tenant_id, puerta_id, resultado, motivo_code) VALUES (?, ?, ?, ?)',
        [a.cuenta.id, a.puertaPrincipal.id, resultado, 'prueba'],
      );
    }
    expect((await pedir()).accesos_por_dia.at(-1)).toMatchObject({
      dia: hoyLocal(),
      permitidos: 2,
      rechazados: 1,
      repeticiones_permitidas: 0,
      repeticiones_rechazadas: 0,
    });
  });

  it('cuenta aparte las repeticiones (ADR 0032): no suman a permitidos pero no quedan invisibles', async () => {
    const [original] = await prueba.pool.query<ResultSetHeader>(
      'INSERT INTO lecturas (tenant_id, puerta_id, resultado, motivo_code) VALUES (?, ?, ?, ?)',
      [a.cuenta.id, a.puertaPrincipal.id, 'permitido', 'acceso.permitido'],
    );
    for (const resultado of ['permitido', 'rechazado']) {
      await prueba.pool.query(
        'INSERT INTO lecturas (tenant_id, puerta_id, resultado, motivo_code, repetido_de_id) VALUES (?, ?, ?, ?, ?)',
        [a.cuenta.id, a.puertaPrincipal.id, resultado, 'prueba', original.insertId],
      );
    }
    expect((await pedir()).accesos_por_dia.at(-1)).toMatchObject({
      permitidos: 1,
      rechazados: 0,
      repeticiones_permitidas: 1,
      repeticiones_rechazadas: 1,
    });
  });

  it('exige una sesión de plataforma', async () => {
    const respuesta = await prueba.app.inject({
      method: 'GET',
      url: '/api/v1/plataforma/estadisticas',
    });
    expect(respuesta.statusCode).toBe(401);
  });
});
