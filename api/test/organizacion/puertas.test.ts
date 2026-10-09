import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { crearEscenario, crearPuerta, type Escenario } from '../helpers/fixtures.js';
import { conUsuario, iniciarSesion, type Sesion } from '../helpers/http.js';

describe('GET /api/v1/puertas', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let sesionA: Sesion;

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
    sesionA = await iniciarSesion(prueba.app, a.usuario.pin);
  });

  const listar = (sesion: Sesion, consulta = '') =>
    prueba.app.inject({
      method: 'GET',
      url: `/api/v1/puertas${consulta}`,
      headers: conUsuario(sesion),
    });

  it('lista las puertas de la cuenta con su sitio, en el formato del contrato', async () => {
    const respuesta = await listar(sesionA);
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({
      datos: [
        {
          id: a.puertaPrincipal.id,
          nombre: 'Principal AAA',
          sitio: { id: a.sitioId, nombre: 'Sitio AAA' },
          dispositivo: {
            id: a.dispositivoPrincipal.id,
            nombre: `Dispositivo ${a.puertaPrincipal.id}`,
            en_linea: false,
            ultimo_latido_at: null,
          },
        },
        {
          id: a.puertaTrasera.id,
          nombre: 'Trasera AAA',
          sitio: { id: a.sitioId, nombre: 'Sitio AAA' },
          dispositivo: {
            id: a.dispositivoTrasero.id,
            nombre: `Dispositivo ${a.puertaTrasera.id}`,
            en_linea: false,
            ultimo_latido_at: null,
          },
        },
      ],
      meta: { pagina: 1, por_pagina: 25, total: 2 },
    });
  });

  it('aislamiento: la cuenta A nunca ve puertas de la B, ni en la lista ni en el total', async () => {
    const respuesta = await listar(sesionA);
    const ids = respuesta.json<{ datos: { id: string }[] }>().datos.map((puerta) => puerta.id);
    expect(ids).not.toContain(b.puertaPrincipal.id);
    expect(ids).not.toContain(b.puertaTrasera.id);

    const deB = await listar(await iniciarSesion(prueba.app, b.usuario.pin));
    expect(deB.json<{ datos: { id: string }[] }>().datos.map((p) => p.id)).toEqual([
      b.puertaPrincipal.id,
      b.puertaTrasera.id,
    ]);
  });

  it('pagina con pagina y por_pagina, y rechaza un tamaño fuera de rango', async () => {
    await crearPuerta(prueba.pool, a.cuenta, a.sitioId, 'Tercera AAA');
    const segunda = await listar(sesionA, '?pagina=2&por_pagina=2');
    // Orden: sitio y nombre de la puerta (Principal, Tercera, Trasera)
    expect(segunda.json()).toMatchObject({
      datos: [{ id: a.puertaTrasera.id, nombre: 'Trasera AAA' }],
      meta: { pagina: 2, por_pagina: 2, total: 3 },
    });
    expect((await listar(sesionA, '?por_pagina=101')).statusCode).toBe(400);
    expect((await listar(sesionA, '?pagina=0')).statusCode).toBe(400);
  });

  it('dice si el lector está en línea según su último latido (HU-09)', async () => {
    const reciente = new Date(Date.now() - 30_000);
    const viejo = new Date(Date.now() - 10 * 60_000);
    await prueba.pool.query('UPDATE dispositivos SET ultimo_latido_at = ? WHERE id = ?', [
      reciente,
      a.dispositivoPrincipal.id,
    ]);
    await prueba.pool.query('UPDATE dispositivos SET ultimo_latido_at = ? WHERE id = ?', [
      viejo,
      a.dispositivoTrasero.id,
    ]);
    const respuesta = await listar(sesionA);
    const puertas = respuesta.json<{ datos: { dispositivo: { en_linea: boolean } }[] }>().datos;
    expect(puertas.map((puerta) => puerta.dispositivo.en_linea)).toEqual([true, false]);
  });

  it('una puerta sin lector en servicio (revocado) trae dispositivo null', async () => {
    await prueba.pool.query('UPDATE dispositivos SET revocado_at = NOW(3) WHERE id = ?', [
      a.dispositivoPrincipal.id,
    ]);
    const respuesta = await listar(sesionA);
    const puertas = respuesta.json<{ datos: { dispositivo: unknown }[] }>().datos;
    expect(puertas[0]?.dispositivo).toBeNull();
    expect(puertas[1]?.dispositivo).not.toBeNull();
  });

  it('no muestra puertas borradas ni desactivadas', async () => {
    await prueba.pool.query('UPDATE puertas SET deleted_at = NOW(3) WHERE id = ?', [
      a.puertaTrasera.id,
    ]);
    const respuesta = await listar(sesionA);
    expect(respuesta.json<{ meta: { total: number } }>().meta.total).toBe(1);
    await prueba.pool.query('UPDATE puertas SET activo = 0 WHERE id = ?', [a.puertaPrincipal.id]);
    expect((await listar(sesionA)).json<{ meta: { total: number } }>().meta.total).toBe(0);
  });

  it('sin sesión es 401 y con un rol sin el permiso es 403', async () => {
    const sinSesion = await prueba.app.inject({ method: 'GET', url: '/api/v1/puertas' });
    expect(sinSesion.statusCode).toBe(401);
    await prueba.pool.query(
      'DELETE rp FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id WHERE p.codigo = ? AND rp.rol_id = ?',
      ['organizacion.puerta.ver', a.rolUsuarioId],
    );
    const sinPermiso = await listar(sesionA);
    expect(sinPermiso.statusCode).toBe(403);
  });
});
