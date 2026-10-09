import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { crearEscenario, type Escenario } from '../helpers/fixtures.js';
import { conUsuario, iniciarSesion } from '../helpers/http.js';

describe('dispositivos: latido y configuración', () => {
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

  const latido = (authorization: string | undefined, payload: object) =>
    prueba.app.inject({
      method: 'POST',
      url: '/api/v1/dispositivos/latidos',
      headers: authorization === undefined ? {} : { authorization },
      payload,
    });

  describe('POST /api/v1/dispositivos/latidos', () => {
    it('responde 204 y anota firmware, señal y estado de la puerta, sin llenar la bitácora', async () => {
      const respuesta = await latido(a.dispositivoPrincipal.encabezado, {
        firmware: '1.2.0',
        rssi: -61,
        puerta_abierta: true,
      });
      expect(respuesta.statusCode).toBe(204);
      expect(respuesta.body).toBe('');

      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT * FROM dispositivos WHERE id = ?',
        [a.dispositivoPrincipal.id],
      );
      expect(filas[0]).toMatchObject({
        firmware_version: '1.2.0',
        ultimo_rssi: -61,
        ultima_puerta_abierta: 1,
      });
      expect(filas[0]?.ultimo_latido_at).toBeInstanceOf(Date);
      const [bitacora] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT id FROM bitacoras WHERE tabla = 'dispositivos'",
      );
      expect(bitacora).toHaveLength(0);
    });

    it('cada dispositivo anota lo suyo: el de la cuenta B no toca al de la A', async () => {
      await latido(b.dispositivoPrincipal.encabezado, {
        firmware: '9.9.9',
        rssi: -40,
        puerta_abierta: false,
      });
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT id, firmware_version FROM dispositivos ORDER BY id',
      );
      const porId = new Map(filas.map((fila) => [String(fila.id), fila.firmware_version]));
      expect(porId.get(b.dispositivoPrincipal.id)).toBe('9.9.9');
      expect(porId.get(a.dispositivoPrincipal.id)).toBeNull();
    });

    it('valida el cuerpo', async () => {
      for (const payload of [
        {},
        { firmware: '1', rssi: 'fuerte', puerta_abierta: false },
        { firmware: 'x'.repeat(21), rssi: -1, puerta_abierta: false },
      ]) {
        const respuesta = await latido(a.dispositivoPrincipal.encabezado, payload);
        expect(respuesta.statusCode).toBe(400);
        expect(respuesta.json()).toMatchObject({ code: 'validacion.invalida' });
      }
    });

    it('sin credencial, con credencial inválida o con un usuario: 401', async () => {
      const sesion = await iniciarSesion(prueba.app, a.administrador.pin);
      const cuerpo = { firmware: '1.0.0', rssi: -50, puerta_abierta: false };
      for (const authorization of [
        undefined,
        `Dispositivo ${a.dispositivoPrincipal.id}.${'z'.repeat(43)}`,
        `Bearer ${sesion.acceso}`,
      ]) {
        expect((await latido(authorization, cuerpo)).statusCode).toBe(401);
      }
    });

    it('un dispositivo revocado deja de poder reportar', async () => {
      await prueba.pool.query('UPDATE dispositivos SET revocado_at = NOW(3) WHERE id = ?', [
        a.dispositivoPrincipal.id,
      ]);
      const respuesta = await latido(a.dispositivoPrincipal.encabezado, {
        firmware: '1',
        rssi: -1,
        puerta_abierta: false,
      });
      expect(respuesta.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/dispositivos/configuracion', () => {
    const configuracion = (authorization: string | undefined) =>
      prueba.app.inject({
        method: 'GET',
        url: '/api/v1/dispositivos/configuracion',
        headers: authorization === undefined ? {} : { authorization },
      });

    it('entrega los segundos de apertura de su puerta y la zona horaria de su sitio', async () => {
      expect((await configuracion(a.dispositivoPrincipal.encabezado)).json()).toEqual({
        segundos_apertura: 6,
        zona_horaria: 'America/La_Paz',
        ota: null,
      });
      expect((await configuracion(a.dispositivoTrasero.encabezado)).json()).toMatchObject({
        segundos_apertura: 5,
      });
    });

    it('cada dispositivo ve la configuración de su propia puerta, nunca la de otra cuenta', async () => {
      await prueba.pool.query('UPDATE puertas SET segundos_apertura = 9 WHERE id = ?', [
        b.puertaPrincipal.id,
      ]);
      expect((await configuracion(a.dispositivoPrincipal.encabezado)).json()).toMatchObject({
        segundos_apertura: 6,
      });
      expect((await configuracion(b.dispositivoPrincipal.encabezado)).json()).toMatchObject({
        segundos_apertura: 9,
      });
    });

    it('401 sin credencial de dispositivo; un usuario no entra a las rutas del dispositivo', async () => {
      expect((await configuracion(undefined)).statusCode).toBe(401);
      const sesion = await iniciarSesion(prueba.app, a.administrador.pin);
      expect((await configuracion(`Bearer ${sesion.acceso}`)).statusCode).toBe(401);
    });
  });

  it('una credencial de dispositivo no sirve en las rutas de usuario', async () => {
    for (const url of [
      '/api/v1/puertas',
      '/api/v1/qr-accesos',
      '/api/v1/eventos-acceso',
      '/api/v1/sesiones/actual',
    ]) {
      const respuesta = await prueba.app.inject({
        method: 'GET',
        url,
        headers: { authorization: a.dispositivoPrincipal.encabezado },
      });
      expect(respuesta.statusCode, url).toBe(401);
    }
    const conBearer = await prueba.app.inject({
      method: 'GET',
      url: '/api/v1/puertas',
      headers: conUsuario({ acceso: 'a.b.c' }),
    });
    expect(conBearer.statusCode).toBe(401);
  });
});
