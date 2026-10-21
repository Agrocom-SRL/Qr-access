import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  crearEscenario,
  crearRol,
  crearUsuarioConPin,
  type Escenario,
  type UsuarioDePrueba,
} from '../helpers/fixtures.js';
import { conUsuario, iniciarSesion, type Sesion } from '../helpers/http.js';

const PERMISOS_DE_GUARDIA = [
  'organizacion.puerta.ver',
  'organizacion.puerta.supervisar',
  'accesos.qr.generar',
  'accesos.evento.ver',
  'accesos.evento.ver_asignadas',
];

describe('asignación de guardias a puertas y alcance de sus eventos', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let guardia: UsuarioDePrueba;
  let admin: Sesion;
  let sesionGuardia: Sesion;
  let sesionUsuario: Sesion;

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
    const rolGuardia = await crearRol(prueba.pool, a.cuenta, 'Guardia', PERMISOS_DE_GUARDIA);
    guardia = await crearUsuarioConPin(prueba.pool, a.cuenta, 'GU01', [rolGuardia]);
    admin = await iniciarSesion(prueba.app, a.administrador.pin);
    sesionGuardia = await iniciarSesion(prueba.app, guardia.pin);
    sesionUsuario = await iniciarSesion(prueba.app, a.usuario.pin);
    for (const [escenario, puerta, dispositivo] of [
      [a, a.puertaPrincipal, a.dispositivoPrincipal],
      [a, a.puertaTrasera, a.dispositivoTrasero],
      [b, b.puertaPrincipal, b.dispositivoPrincipal],
    ] as const) {
      await prueba.pool.query(
        `INSERT INTO eventos_acceso (tenant_id, puerta_id, dispositivo_id, token_hash, metodo, resultado, motivo_code, ocurrido_at)
         VALUES (?, ?, ?, ?, 'qr', 'rechazado', 'qr.desconocido', UTC_TIMESTAMP(3))`,
        [escenario.cuenta.id, puerta.id, dispositivo.id, `hash-${puerta.id}`],
      );
    }
  });

  const llamar = (sesion: Sesion, method: 'GET' | 'PUT', url: string, payload?: object) =>
    prueba.app.inject({
      method,
      url: `/api/v1${url}`,
      headers: conUsuario(sesion),
      ...(payload === undefined ? {} : { payload }),
    });
  const asignar = (usuarioId: string, cuerpo: object, sesion = admin) =>
    llamar(sesion, 'PUT', `/usuarios/${usuarioId}/puertas-asignadas`, cuerpo);
  const puertasVistas = async (sesion: Sesion) =>
    (await llamar(sesion, 'GET', '/eventos-acceso'))
      .json<{
        datos: { puerta: { id: string } }[];
      }>()
      .datos.map((evento) => evento.puerta.id)
      .sort();

  it('sin puertas asignadas, el guardia no ve ningún evento', async () => {
    expect(await puertasVistas(sesionGuardia)).toEqual([]);
  });

  it('con una puerta asignada ve solo sus eventos; con "todas", los de toda su cuenta', async () => {
    expect(
      (await asignar(guardia.id, { todas: false, puerta_ids: [a.puertaPrincipal.id] })).statusCode,
    ).toBe(204);
    expect(await puertasVistas(sesionGuardia)).toEqual([a.puertaPrincipal.id]);

    expect((await asignar(guardia.id, { todas: true, puerta_ids: [] })).statusCode).toBe(204);
    expect(await puertasVistas(sesionGuardia)).toEqual(
      [a.puertaPrincipal.id, a.puertaTrasera.id].sort(),
    );
    const leida = await llamar(admin, 'GET', `/usuarios/${guardia.id}/puertas-asignadas`);
    expect(leida.json()).toEqual({ todas: true, puerta_ids: [] });
  });

  it('el administrador ve los eventos de toda la cuenta y el usuario, solo los de sus QR', async () => {
    expect(await puertasVistas(admin)).toEqual([a.puertaPrincipal.id, a.puertaTrasera.id].sort());
    expect(await puertasVistas(sesionUsuario)).toEqual([]);
  });

  it('reasignar reemplaza las puertas anteriores y no duplica filas', async () => {
    await asignar(guardia.id, { todas: false, puerta_ids: [a.puertaPrincipal.id] });
    await asignar(guardia.id, { todas: false, puerta_ids: [a.puertaTrasera.id] });
    await asignar(guardia.id, { todas: false, puerta_ids: [a.puertaTrasera.id] });
    const leida = await llamar(admin, 'GET', `/usuarios/${guardia.id}/puertas-asignadas`);
    expect(leida.json()).toEqual({ todas: false, puerta_ids: [a.puertaTrasera.id] });
  });

  it('exige el permiso de asignar: guardia y usuario reciben 403', async () => {
    for (const sesion of [sesionGuardia, sesionUsuario]) {
      expect((await asignar(guardia.id, { todas: true, puerta_ids: [] }, sesion)).statusCode).toBe(
        403,
      );
      expect(
        (await llamar(sesion, 'GET', `/usuarios/${guardia.id}/puertas-asignadas`)).statusCode,
      ).toBe(403);
    }
  });

  it('aislamiento: no se asigna una puerta ni un usuario de otra cuenta (404)', async () => {
    expect(
      (await asignar(guardia.id, { todas: false, puerta_ids: [b.puertaPrincipal.id] })).statusCode,
    ).toBe(404);
    expect(
      (await asignar(b.usuario.id, { todas: false, puerta_ids: [a.puertaPrincipal.id] }))
        .statusCode,
    ).toBe(404);
    const [filas] = await prueba.pool.query('SELECT id FROM asignaciones_puerta');
    expect(filas).toEqual([]);
  });
});
