import type { RowDataPacket } from 'mysql2/promise';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { crearEscenario, crearSuperAdmin, type Escenario } from '../helpers/fixtures.js';
import { conUsuario, iniciarSesionDePlataforma } from '../helpers/http.js';

interface Listado {
  datos: {
    id: string;
    resultado: 'permitido' | 'rechazado';
    motivo_code: string;
    repeticiones_permitidas: number;
    repeticiones_rechazadas: number;
    cuenta: { codigo: string };
    puerta: { nombre: string };
  }[];
  meta: { total: number };
}

describe('plataforma: accesos de todas las cuentas', () => {
  let prueba: AppDePrueba;
  let headers: { authorization: string };
  let a: Escenario;
  let b: Escenario;

  beforeEach(async () => {
    prueba = await crearAppDePrueba();
    await reiniciarBase(prueba.pool);
    const lucia = await crearSuperAdmin(prueba.pool, 'lucia.paz');
    headers = conUsuario(
      await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', lucia.contrasena),
    );
    a = await crearEscenario(prueba.pool, 'AAA');
    b = await crearEscenario(prueba.pool, 'BBB');
    const intentos: [Escenario, string, string][] = [
      [a, 'permitido', 'ok'],
      [a, 'rechazado', 'qr_vencido'],
      [b, 'permitido', 'ok'],
    ];
    for (const [escenario, resultado, motivo] of intentos) {
      await prueba.pool.query(
        'INSERT INTO lecturas (tenant_id, puerta_id, resultado, motivo_code) VALUES (?, ?, ?, ?)',
        [escenario.cuenta.id, escenario.puertaPrincipal.id, resultado, motivo],
      );
    }
  });
  afterEach(async () => {
    await prueba.cerrar();
  });

  const pedir = async (consulta = '') => {
    const respuesta = await prueba.app.inject({
      method: 'GET',
      url: `/api/v1/plataforma/eventos-acceso${consulta}`,
      headers,
    });
    expect(respuesta.statusCode, respuesta.body).toBe(200);
    return respuesta.json<Listado>();
  };

  it('lista los intentos de todas las cuentas con su cuenta y su puerta', async () => {
    const listado = await pedir();
    expect(listado.meta.total).toBe(3);
    expect(new Set(listado.datos.map((e) => e.cuenta.codigo))).toEqual(new Set(['AAA', 'BBB']));
  });

  it('filtra por cuenta y por resultado', async () => {
    const deA = await pedir(`?cuenta_id=${a.cuenta.id}`);
    expect(deA.datos.every((e) => e.cuenta.codigo === 'AAA')).toBe(true);
    expect(deA.meta.total).toBe(2);
    const rechazados = await pedir('?resultado=rechazado');
    expect(rechazados.datos).toHaveLength(1);
    expect(rechazados.datos[0]?.motivo_code).toBe('qr_vencido');
  });

  it('el original expone sus repeticiones permitidas y rechazadas, y no las lista aparte', async () => {
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT id FROM lecturas WHERE tenant_id = ? AND resultado = ?',
      [a.cuenta.id, 'permitido'],
    );
    const originalId = String(filas[0]?.id);
    for (const resultado of ['permitido', 'rechazado', 'rechazado']) {
      await prueba.pool.query(
        'INSERT INTO lecturas (tenant_id, puerta_id, resultado, motivo_code, repetido_de_id) VALUES (?, ?, ?, ?, ?)',
        [a.cuenta.id, a.puertaPrincipal.id, resultado, 'ok', originalId],
      );
    }
    const listado = await pedir();
    expect(listado.meta.total).toBe(3);
    const evento = listado.datos.find((e) => e.id === originalId);
    expect(evento).toMatchObject({ repeticiones_permitidas: 1, repeticiones_rechazadas: 2 });
  });

  it('exige una sesión de plataforma', async () => {
    const respuesta = await prueba.app.inject({
      method: 'GET',
      url: '/api/v1/plataforma/eventos-acceso',
    });
    expect(respuesta.statusCode).toBe(401);
  });
});
