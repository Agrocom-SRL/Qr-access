import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  contarFilas,
  crearEscenario,
  crearSuperAdmin,
  type Escenario,
} from '../helpers/fixtures.js';
import {
  conUsuario,
  iniciarSesion,
  iniciarSesionDePlataforma,
  type Problema,
} from '../helpers/http.js';

describe('sensor de puerta: latido ampliado y configuración por dispositivo (ADR 0031 §18)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let acceso: string;
  let placaA: string;

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
    const admin = await crearSuperAdmin(prueba.pool, 'lucia.paz');
    acceso = (await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', admin.contrasena)).acceso;
    placaA = await vincularPlaca('aa:bb:cc:00:00:01', a.dispositivoPrincipal.id);
  });

  /** Una placa del inventario enlazada a un dispositivo ya creado por el escenario. */
  async function vincularPlaca(mac: string, dispositivoId: string): Promise<string> {
    const [resultado] = await prueba.pool.query(
      'INSERT INTO placas (mac, firmware_version) VALUES (?, ?)',
      [mac, '1.0.0'],
    );
    const id = String((resultado as { insertId: number }).insertId);
    await prueba.pool.query('UPDATE dispositivos SET placa_id = ? WHERE id = ?', [
      id,
      dispositivoId,
    ]);
    return id;
  }

  const latido = (encabezado: string, payload: object) =>
    prueba.app.inject({
      method: 'POST',
      url: '/api/v1/dispositivos/latidos',
      headers: { authorization: encabezado },
      payload,
    });
  const configuracion = (encabezado: string) =>
    prueba.app.inject({
      method: 'GET',
      url: '/api/v1/dispositivos/configuracion',
      headers: { authorization: encabezado },
    });
  const configurar = (placaId: string, payload: unknown, token = acceso) =>
    prueba.app.inject({
      method: 'PUT',
      url: `/api/v1/plataforma/placas/${placaId}/sensor`,
      headers: conUsuario({ acceso: token }),
      payload: payload as object,
    });
  const sensorDe = async (id: string) =>
    (
      await prueba.pool.query<RowDataPacket[]>(
        'SELECT sensor_instalado, sensor_abierto_nivel, sensor_estado, sensor_informado_at FROM dispositivos WHERE id = ?',
        [id],
      )
    )[0][0];

  describe('latido ampliado', () => {
    it('guarda el estado del sensor y cuándo lo informó; sin el campo no se toca lo guardado', async () => {
      const base = { firmware: '1.3.0', rssi: -60, puerta_abierta: false };
      expect(
        (await latido(a.dispositivoPrincipal.encabezado, { ...base, sensor_puerta: 'cerrada' }))
          .statusCode,
      ).toBe(204);
      expect(await sensorDe(a.dispositivoPrincipal.id)).toMatchObject({ sensor_estado: 'cerrada' });
      expect((await sensorDe(a.dispositivoPrincipal.id))?.sensor_informado_at).not.toBeNull();

      await latido(a.dispositivoPrincipal.encabezado, { ...base, sensor_puerta: 'abierta' });
      expect(await sensorDe(a.dispositivoPrincipal.id)).toMatchObject({ sensor_estado: 'abierta' });
      // Un firmware que no lo informa no borra el último valor.
      await latido(a.dispositivoPrincipal.encabezado, base);
      expect(await sensorDe(a.dispositivoPrincipal.id)).toMatchObject({ sensor_estado: 'abierta' });
      await latido(a.dispositivoPrincipal.encabezado, { ...base, sensor_puerta: 'sin_sensor' });
      expect(await sensorDe(a.dispositivoPrincipal.id)).toMatchObject({
        sensor_estado: 'sin_sensor',
      });
    });

    it('acepta el latido anterior (sin lector ni sensor) y rechaza valores fuera del esquema', async () => {
      const base = { firmware: '1.3.0', rssi: -60, puerta_abierta: false };
      expect((await latido(a.dispositivoPrincipal.encabezado, base)).statusCode).toBe(204);
      expect(
        (await latido(a.dispositivoPrincipal.encabezado, { ...base, sensor_puerta: 'rota' }))
          .statusCode,
      ).toBe(400);
      expect(
        (await latido(a.dispositivoPrincipal.encabezado, { ...base, otro: 1 })).statusCode,
      ).toBe(400);
    });

    it('el latido de A no toca el sensor de B', async () => {
      await latido(a.dispositivoPrincipal.encabezado, {
        firmware: '1.3.0',
        rssi: -60,
        puerta_abierta: true,
        sensor_puerta: 'abierta',
      });
      expect((await sensorDe(b.dispositivoPrincipal.id))?.sensor_estado).toBeNull();
    });

    it('el latido no entra a la bitácora (telemetría)', async () => {
      await latido(a.dispositivoPrincipal.encabezado, {
        firmware: '1.3.0',
        rssi: -60,
        puerta_abierta: true,
        sensor_puerta: 'abierta',
      });
      expect(await contarFilas(prueba.pool, 'bitacoras', "tabla = 'dispositivos'")).toBe(0);
    });
  });

  describe('configuración del sensor por dispositivo', () => {
    it('por omisión no hay sensor y la polaridad es la que hoy compila el firmware (alto = abierta)', async () => {
      expect((await configuracion(a.dispositivoPrincipal.encabezado)).json()).toMatchObject({
        sensor_puerta: { instalado: false, nivel_abierto: 'alto' },
        segundos_apertura: 6,
        espera_confirmacion_segundos: 11,
      });
    });

    it('AGROCOM la habilita y la placa la recibe; solo cambia la de esa placa', async () => {
      const respuesta = await configurar(placaA, { instalado: true, nivel_abierto: 'bajo' });
      expect(respuesta.statusCode).toBe(204);
      expect((await configuracion(a.dispositivoPrincipal.encabezado)).json()).toMatchObject({
        sensor_puerta: { instalado: true, nivel_abierto: 'bajo' },
      });
      expect((await configuracion(a.dispositivoTrasero.encabezado)).json()).toMatchObject({
        sensor_puerta: { instalado: false, nivel_abierto: 'alto' },
      });
      expect((await configuracion(b.dispositivoPrincipal.encabezado)).json()).toMatchObject({
        sensor_puerta: { instalado: false, nivel_abierto: 'alto' },
      });
    });

    it('el cambio queda en la bitácora de la cuenta con el antes y el después', async () => {
      await configurar(placaA, { instalado: true, nivel_abierto: 'bajo' });
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT tenant_id, accion, antes, despues FROM bitacoras WHERE tabla = 'dispositivos' AND registro_id = ?",
        [a.dispositivoPrincipal.id],
      );
      expect(filas).toHaveLength(1);
      expect(String(filas[0]?.tenant_id)).toBe(a.cuenta.id);
      expect(JSON.stringify(filas[0]?.antes)).toContain('"sensor_instalado":0');
      expect(JSON.stringify(filas[0]?.despues)).toContain('"sensor_instalado":1');
      expect(JSON.stringify(filas[0]?.despues)).toContain('bajo');
    });

    it('valida el cuerpo (estricto), exige permiso de plataforma y una placa vinculada', async () => {
      expect((await configurar(placaA, { instalado: true })).statusCode).toBe(400);
      expect(
        (await configurar(placaA, { instalado: true, nivel_abierto: 'medio' })).statusCode,
      ).toBe(400);
      expect(
        (await configurar(placaA, { instalado: true, nivel_abierto: 'alto', cuenta_id: '1' }))
          .statusCode,
      ).toBe(400);

      const cuenta = await iniciarSesion(prueba.app, a.administrador.pin);
      const comoCuenta = await configurar(
        placaA,
        { instalado: true, nivel_abierto: 'alto' },
        cuenta.acceso,
      );
      expect(comoCuenta.statusCode).toBe(401);

      const [libre] = await prueba.pool.query('INSERT INTO placas (mac) VALUES (?)', [
        'aa:bb:cc:00:00:99',
      ]);
      const sinVinculo = await configurar(String((libre as { insertId: number }).insertId), {
        instalado: true,
        nivel_abierto: 'alto',
      });
      expect(sinVinculo.statusCode).toBe(409);
      expect(sinVinculo.json<Problema>().code).toBe('placa.sin_dispositivo');
      expect((await sensorDe(a.dispositivoPrincipal.id))?.sensor_instalado).toBe(0);
    });

    it('el inventario de placas muestra el sensor informado, el configurado y si la puerta falla', async () => {
      await configurar(placaA, { instalado: true, nivel_abierto: 'alto' });
      await latido(a.dispositivoPrincipal.encabezado, {
        firmware: '1.3.0',
        rssi: -60,
        puerta_abierta: false,
        sensor_puerta: 'cerrada',
      });
      const respuesta = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/plataforma/placas?estado=vinculada',
        headers: conUsuario({ acceso }),
      });
      expect(respuesta.statusCode).toBe(200);
      const fila = respuesta
        .json<{
          datos: {
            id: string;
            sensor_puerta: string | null;
            sensor_configurado: unknown;
            apertura_fallida: boolean;
          }[];
        }>()
        .datos.find((placa) => placa.id === placaA);
      expect(fila).toMatchObject({
        sensor_puerta: 'cerrada',
        sensor_configurado: { instalado: true, nivel_abierto: 'alto' },
        apertura_fallida: false,
      });
    });
  });
});
