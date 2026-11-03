import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { crearEscenario, type Escenario } from '../helpers/fixtures.js';

/** `GET /dispositivos/configuracion`: el interruptor `apertura_manual` y el `ETag` de la placa (ADR 0035 §5). */
describe('GET /api/v1/dispositivos/configuracion: apertura_manual y ETag', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;

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
  });

  const pedir = (encabezado: string, cabeceras: Record<string, string> = {}) =>
    prueba.app.inject({
      method: 'GET',
      url: '/api/v1/dispositivos/configuracion',
      headers: { authorization: encabezado, ...cabeceras },
    });

  describe('apertura_manual', () => {
    it('es el interruptor de la puerta de ESA placa', async () => {
      expect((await pedir(a.dispositivoPrincipal.encabezado)).json()).toMatchObject({
        apertura_manual: true,
      });

      await prueba.pool.query('UPDATE puertas SET apertura_manual = 0 WHERE id = ?', [
        a.puertaPrincipal.id,
      ]);

      expect((await pedir(a.dispositivoPrincipal.encabezado)).json()).toMatchObject({
        apertura_manual: false,
      });
      // La otra puerta de la misma cuenta y la de la cuenta B no cambian.
      expect((await pedir(a.dispositivoTrasero.encabezado)).json()).toMatchObject({
        apertura_manual: true,
      });
      expect((await pedir(b.dispositivoPrincipal.encabezado)).json()).toMatchObject({
        apertura_manual: true,
      });
    });

    it('el interruptor de la puerta de otra cuenta no se filtra', async () => {
      await prueba.pool.query('UPDATE puertas SET apertura_manual = 0 WHERE id = ?', [
        b.puertaPrincipal.id,
      ]);
      expect((await pedir(a.dispositivoPrincipal.encabezado)).json()).toMatchObject({
        apertura_manual: true,
      });
      expect((await pedir(b.dispositivoPrincipal.encabezado)).json()).toMatchObject({
        apertura_manual: false,
      });
    });
  });

  describe('ETag e If-None-Match', () => {
    it('la respuesta lleva un ETag entre comillas y no-store', async () => {
      const respuesta = await pedir(a.dispositivoPrincipal.encabezado);
      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.headers.etag).toMatch(/^"[0-9a-f]{32}"$/);
      expect(respuesta.headers['cache-control']).toContain('no-store');
    });

    it('con el mismo ETag en If-None-Match responde 304 sin cuerpo (y vuelve a mandar el ETag)', async () => {
      const etag = String((await pedir(a.dispositivoPrincipal.encabezado)).headers.etag);

      const respuesta = await pedir(a.dispositivoPrincipal.encabezado, { 'if-none-match': etag });

      expect(respuesta.statusCode).toBe(304);
      expect(respuesta.body).toBe('');
      expect(respuesta.headers.etag).toBe(etag);
      expect(respuesta.headers['cache-control']).toContain('no-store');
    });

    it('acepta la forma débil y una lista de valores', async () => {
      const etag = String((await pedir(a.dispositivoPrincipal.encabezado)).headers.etag);
      for (const cabecera of [`W/${etag}`, `"otro", ${etag}`, '*']) {
        expect(
          (await pedir(a.dispositivoPrincipal.encabezado, { 'if-none-match': cabecera }))
            .statusCode,
          cabecera,
        ).toBe(304);
      }
    });

    it('con un ETag que no es el actual responde 200 con la configuración completa', async () => {
      const respuesta = await pedir(a.dispositivoPrincipal.encabezado, {
        'if-none-match': '"viejo"',
      });
      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.json()).toMatchObject({ segundos_apertura: 6, apertura_manual: true });
    });

    it('si el administrador cambia el interruptor (o la duración) el ETag cambia y la placa recibe la nueva', async () => {
      const antes = String((await pedir(a.dispositivoPrincipal.encabezado)).headers.etag);
      await prueba.pool.query('UPDATE puertas SET apertura_manual = 0 WHERE id = ?', [
        a.puertaPrincipal.id,
      ]);

      const respuesta = await pedir(a.dispositivoPrincipal.encabezado, { 'if-none-match': antes });

      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.headers.etag).not.toBe(antes);
      expect(respuesta.json()).toMatchObject({ apertura_manual: false });

      await prueba.pool.query('UPDATE puertas SET segundos_apertura = 9 WHERE id = ?', [
        a.puertaPrincipal.id,
      ]);
      expect(
        (
          await pedir(a.dispositivoPrincipal.encabezado, {
            'if-none-match': String(respuesta.headers.etag),
          })
        ).statusCode,
      ).toBe(200);
    });

    it('el ETag de otra puerta no sirve: dos puertas con la misma configuración no se confunden con otra distinta', async () => {
      const deA = String((await pedir(a.dispositivoPrincipal.encabezado)).headers.etag);
      await prueba.pool.query('UPDATE puertas SET segundos_apertura = 9 WHERE id = ?', [
        b.puertaPrincipal.id,
      ]);
      const respuesta = await pedir(b.dispositivoPrincipal.encabezado, { 'if-none-match': deA });
      expect(respuesta.statusCode).toBe(200);
    });

    it('sin credencial no hay 304 ni ETag: es 401', async () => {
      const respuesta = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/dispositivos/configuracion',
        headers: { 'if-none-match': '*' },
      });
      expect(respuesta.statusCode).toBe(401);
      expect(respuesta.headers.etag).toBeUndefined();
    });
  });
});
