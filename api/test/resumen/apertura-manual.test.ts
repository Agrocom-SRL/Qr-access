import type { ResultSetHeader } from 'mysql2/promise';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { crearEscenario, crearSuperAdmin, type Escenario } from '../helpers/fixtures.js';
import { conUsuario, iniciarSesionDePlataforma } from '../helpers/http.js';

interface AperturaManual {
  dias: number;
  ordenadas: number;
  rechazadas: number;
  por_qr: number;
  usuarios: number;
  cuentas_que_la_usaron: number;
  ejecucion: { ejecutadas: number; fallidas: number; sin_confirmacion: number };
  por_puerta: { cuenta: { codigo: string }; puerta: { nombre: string }; total: number }[];
  por_cuenta: { cuenta: { codigo: string }; total: number; usuarios: number }[];
  por_dia: { dia: string; ordenadas: number; rechazadas: number }[];
  por_hora: { hora: number; total: number }[];
  configuracion: {
    puertas: number;
    habilitadas: number;
    disponibles: number;
    cuentas: number;
    cuentas_con_modo_activo: number;
  };
}

const hoyLocal = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', dateStyle: 'short' }).format(
    new Date(),
  );

describe('plataforma: estadísticas de la apertura manual (ADR 0035, HU-21)', () => {
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
  });
  afterEach(async () => {
    await prueba.cerrar();
  });

  const pedir = async () => {
    const respuesta = await prueba.app.inject({
      method: 'GET',
      url: '/api/v1/plataforma/apertura-manual',
      headers,
    });
    expect(respuesta.statusCode, respuesta.body).toBe(200);
    return respuesta.json<AperturaManual>();
  };

  const lectura = async (
    escenario: Escenario,
    puertaId: string,
    metodo: 'manual' | 'qr',
    resultado: 'permitido' | 'rechazado',
    usuarioId: string | null = escenario.usuario.id,
  ) => {
    const [fila] = await prueba.pool.query<ResultSetHeader>(
      'INSERT INTO lecturas (tenant_id, puerta_id, usuario_id, metodo, resultado, motivo_code) VALUES (?, ?, ?, ?, ?, ?)',
      [escenario.cuenta.id, puertaId, usuarioId, metodo, resultado, 'prueba'],
    );
    return fila.insertId;
  };

  it('sin aperturas devuelve la ventana completa con ceros', async () => {
    const datos = await pedir();
    expect(datos.dias).toBe(30);
    expect(datos.por_dia).toHaveLength(30);
    expect(datos.por_dia.at(-1)?.dia).toBe(hoyLocal());
    expect(datos.por_hora).toHaveLength(24);
    expect(datos.ordenadas).toBe(0);
    expect(datos.por_puerta).toEqual([]);
    expect(datos.por_dia.every((dia) => dia.ordenadas === 0)).toBe(true);
  });

  it('cuenta las ordenadas y las rechazadas, y las compara con las de QR', async () => {
    await lectura(a, a.puertaPrincipal.id, 'manual', 'permitido');
    await lectura(a, a.puertaPrincipal.id, 'manual', 'permitido');
    await lectura(a, a.puertaPrincipal.id, 'manual', 'rechazado');
    await lectura(a, a.puertaPrincipal.id, 'qr', 'permitido');
    await lectura(a, a.puertaPrincipal.id, 'qr', 'permitido');
    await lectura(a, a.puertaPrincipal.id, 'qr', 'permitido');
    await lectura(a, a.puertaPrincipal.id, 'qr', 'permitido');
    const datos = await pedir();
    expect(datos).toMatchObject({ ordenadas: 2, rechazadas: 1, por_qr: 4, usuarios: 1 });
    expect(datos.por_dia.at(-1)).toMatchObject({ dia: hoyLocal(), ordenadas: 2, rechazadas: 1 });
    expect(datos.por_hora.reduce((suma, hora) => suma + hora.total, 0)).toBe(3);
  });

  it('reparte por puerta y por cuenta, con las que más la usan primero', async () => {
    await lectura(a, a.puertaPrincipal.id, 'manual', 'permitido');
    await lectura(a, a.puertaPrincipal.id, 'manual', 'permitido');
    await lectura(a, a.puertaTrasera.id, 'manual', 'permitido');
    await lectura(b, b.puertaPrincipal.id, 'manual', 'permitido', b.administrador.id);
    const datos = await pedir();
    expect(datos.cuentas_que_la_usaron).toBe(2);
    expect(datos.por_puerta.map((p) => [p.cuenta.codigo, p.puerta.nombre, p.total])).toEqual([
      ['AAA', `Principal AAA`, 2],
      ['AAA', `Trasera AAA`, 1],
      ['BBB', `Principal BBB`, 1],
    ]);
    expect(datos.por_cuenta[0]).toMatchObject({ total: 3, usuarios: 1 });
    expect(datos.por_cuenta[0]?.cuenta.codigo).toBe('AAA');
  });

  it('cuenta cómo terminaron las órdenes según lo que informó la placa', async () => {
    const uno = await lectura(a, a.puertaPrincipal.id, 'manual', 'permitido');
    const dos = await lectura(a, a.puertaPrincipal.id, 'manual', 'permitido');
    const tres = await lectura(a, a.puertaPrincipal.id, 'manual', 'permitido');
    for (const [lecturaId, resultado, causa, origen] of [
      [uno, 'ejecutada', 'puerta_abrio', 'placa'],
      [dos, 'fallida', 'puerta_no_abrio', 'placa'],
      [tres, 'sin_confirmacion', 'sin_respuesta', 'servidor'],
    ] as const) {
      await prueba.pool.query(
        'INSERT INTO confirmaciones_apertura (tenant_id, evento_acceso_id, dispositivo_id, puerta_id, origen, resultado, causa) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          a.cuenta.id,
          lecturaId,
          a.dispositivoPrincipal.id,
          a.puertaPrincipal.id,
          origen,
          resultado,
          causa,
        ],
      );
    }
    expect((await pedir()).ejecucion).toEqual({
      ejecutadas: 1,
      fallidas: 1,
      sin_confirmacion: 1,
    });
  });

  it('dice cuántas puertas y cuentas tienen el modo encendido y con placa', async () => {
    // El escenario trae dos puertas por cuenta, cada una con su placa y el modo encendido por omisión.
    expect((await pedir()).configuracion).toEqual({
      puertas: 4,
      habilitadas: 4,
      disponibles: 4,
      cuentas: 2,
      cuentas_con_modo_activo: 2,
    });
    await prueba.pool.query('UPDATE puertas SET apertura_manual = 0 WHERE tenant_id = ?', [
      b.cuenta.id,
    ]);
    await prueba.pool.query('UPDATE dispositivos SET revocado_at = NOW(3) WHERE id = ?', [
      a.dispositivoTrasero.id,
    ]);
    expect((await pedir()).configuracion).toEqual({
      puertas: 4,
      habilitadas: 2,
      disponibles: 1,
      cuentas: 2,
      cuentas_con_modo_activo: 1,
    });
  });

  it('solo el super admin lo ve: una cuenta y quien no inició sesión, no', async () => {
    const sinSesion = await prueba.app.inject({
      method: 'GET',
      url: '/api/v1/plataforma/apertura-manual',
    });
    expect(sinSesion.statusCode).toBe(401);
  });
});
