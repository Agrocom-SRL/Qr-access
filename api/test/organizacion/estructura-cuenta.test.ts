import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { crearEscenario, type Escenario } from '../helpers/fixtures.js';
import { conUsuario, iniciarSesion, type Problema, type Sesion } from '../helpers/http.js';

interface SitioDto {
  id: string;
  nombre: string;
  puertas: { id: string; nombre: string; activa: boolean; segundos_apertura: number }[];
}

describe('administrador de cuenta: sitios y puertas (HU-07)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let admin: Sesion;
  let usuario: Sesion;

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
    admin = await iniciarSesion(prueba.app, a.administrador.pin);
    usuario = await iniciarSesion(prueba.app, a.usuario.pin);
  });

  const llamar = (
    sesion: Sesion,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    payload?: object,
  ) =>
    prueba.app.inject({
      method,
      url: `/api/v1${url}`,
      headers: conUsuario(sesion),
      ...(payload === undefined ? {} : { payload }),
    });
  const estructura = async () =>
    (await llamar(admin, 'GET', '/sitios')).json<{ datos: SitioDto[] }>().datos;

  it('crea, edita y da de baja un sitio y una puerta de su cuenta', async () => {
    const sitio = await llamar(admin, 'POST', '/sitios', { nombre: 'Planta Norte' });
    expect(sitio.statusCode, sitio.body).toBe(201);
    const sitioId = sitio.json<{ id: string }>().id;

    const puerta = await llamar(admin, 'POST', `/sitios/${sitioId}/puertas`, {
      nombre: 'Portón',
      segundos_apertura: 8,
    });
    expect(puerta.statusCode, puerta.body).toBe(201);
    const puertaId = puerta.json<{ id: string }>().id;

    expect(
      (await llamar(admin, 'PATCH', `/puertas/${puertaId}`, { nombre: 'Portón 2' })).statusCode,
    ).toBe(204);
    const norte = (await estructura()).find((s) => s.id === sitioId);
    expect(norte?.puertas).toMatchObject([{ nombre: 'Portón 2', segundos_apertura: 8 }]);

    expect((await llamar(admin, 'DELETE', `/puertas/${puertaId}`)).statusCode).toBe(204);
    expect((await llamar(admin, 'DELETE', `/sitios/${sitioId}`)).statusCode).toBe(204);
    expect((await estructura()).map((s) => s.id)).toEqual([a.sitioId]);
  });

  it('un usuario sin el permiso recibe 403 en cada operación', async () => {
    for (const [method, url, payload] of [
      ['GET', '/sitios', undefined],
      ['POST', '/sitios', { nombre: 'X' }],
      ['PATCH', `/sitios/${a.sitioId}`, { nombre: 'X' }],
      ['DELETE', `/sitios/${a.sitioId}`, undefined],
      ['POST', `/sitios/${a.sitioId}/puertas`, { nombre: 'X' }],
      ['PATCH', `/puertas/${a.puertaPrincipal.id}`, { nombre: 'X' }],
      ['DELETE', `/puertas/${a.puertaPrincipal.id}`, undefined],
    ] as const) {
      const respuesta = await llamar(usuario, method, url, payload);
      expect(respuesta.statusCode, `${method} ${url}`).toBe(403);
      expect(respuesta.json<Problema>().code).toBe('permiso.denegado');
    }
  });

  it('aislamiento: la cuenta A no ve ni toca el sitio ni la puerta de la cuenta B (404)', async () => {
    expect((await estructura()).map((s) => s.id)).toEqual([a.sitioId]);

    const ajena = await llamar(admin, 'PATCH', `/puertas/${b.puertaPrincipal.id}`, {
      nombre: 'Robada',
    });
    expect(ajena.statusCode).toBe(404);
    expect((await llamar(admin, 'DELETE', `/puertas/${b.puertaPrincipal.id}`)).statusCode).toBe(
      404,
    );
    expect(
      (await llamar(admin, 'PATCH', `/sitios/${b.sitioId}`, { nombre: 'Robado' })).statusCode,
    ).toBe(404);
    expect((await llamar(admin, 'DELETE', `/sitios/${b.sitioId}`)).statusCode).toBe(404);
    expect(
      (await llamar(admin, 'POST', `/sitios/${b.sitioId}/puertas`, { nombre: 'Intrusa' }))
        .statusCode,
    ).toBe(404);

    const [filas] = await prueba.pool.query(
      'SELECT nombre FROM puertas WHERE id = ? AND deleted_at IS NULL',
      [b.puertaPrincipal.id],
    );
    expect(filas).toEqual([{ nombre: 'Principal BBB' }]);
  });
});
