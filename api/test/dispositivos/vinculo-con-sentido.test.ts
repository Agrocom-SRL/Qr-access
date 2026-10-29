import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  crearEscenario,
  crearPuerta,
  crearSuperAdmin,
  type Escenario,
} from '../helpers/fixtures.js';
import { conUsuario, iniciarSesionDePlataforma, type Problema } from '../helpers/http.js';

const MAC_1 = 'AA:BB:CC:00:11:01';
const MAC_2 = 'AA:BB:CC:00:11:02';
const CLAVE_1 = 'a'.repeat(64);
const CLAVE_2 = 'b'.repeat(64);

type Sentido = 'entrada' | 'salida' | 'ambos';

/** La ubicación del lector al vincular una placa (ADR 0035 §4): de la solicitud del super admin al dispositivo. */
describe('vincular una placa con su sentido (ADR 0035 §4)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let acceso: string;
  let puerta: string;

  beforeAll(async () => {
    prueba = await crearAppDePrueba();
  });
  afterAll(async () => {
    await prueba.cerrar();
  });
  beforeEach(async () => {
    await reiniciarBase(prueba.pool);
    a = await crearEscenario(prueba.pool, 'AAA');
    const admin = await crearSuperAdmin(prueba.pool, 'lucia.paz');
    acceso = (await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', admin.contrasena)).acceso;
    puerta = (await crearPuerta(prueba.pool, a.cuenta, a.sitioId, 'Caseta')).id;
  });

  const plataforma = (method: 'GET' | 'POST', url: string, payload?: object) =>
    prueba.app.inject({
      method,
      url: `/api/v1/plataforma${url}`,
      headers: conUsuario({ acceso }),
      ...(payload === undefined ? {} : { payload }),
    });
  const anunciar = (mac: string, clave: string) =>
    prueba.app.inject({
      method: 'POST',
      url: '/api/v1/dispositivos/anunciar',
      payload: { mac, clave, firmware: '1.0.0' },
    });
  const confirmar = (mac: string, clave: string) =>
    prueba.app.inject({
      method: 'POST',
      url: '/api/v1/dispositivos/confirmar',
      payload: { mac, clave },
    });
  async function placa(mac: string, clave: string): Promise<string> {
    await anunciar(mac, clave);
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT id FROM placas WHERE mac = ? AND deleted_at IS NULL',
      [mac],
    );
    return String(filas[0]?.id);
  }
  const pedir = (id: string, sentido?: Sentido | 'diagonal', puertaId = puerta) =>
    plataforma('POST', `/placas/${id}/vincular`, {
      cuenta_id: a.cuenta.id,
      puerta_id: puertaId,
      nombre: 'Lector',
      ...(sentido === undefined ? {} : { sentido }),
    });
  /** Pide, confirma con el botón y devuelve el sentido que quedó en el dispositivo. */
  async function vincular(mac: string, clave: string, sentido?: Sentido): Promise<string> {
    const id = await placa(mac, clave);
    const solicitud = await pedir(id, sentido);
    expect(solicitud.statusCode, solicitud.body).toBe(202);
    const respuesta = await confirmar(mac, clave);
    expect(respuesta.statusCode, respuesta.body).toBe(200);
    return respuesta.json<{ dispositivo_id: string }>().dispositivo_id;
  }
  const sentidosDeLaPuerta = async (): Promise<string[]> => {
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT sentido FROM dispositivos WHERE puerta_id = ? AND revocado_at IS NULL ORDER BY id',
      [puerta],
    );
    return filas.map((fila) => String(fila.sentido));
  };

  it('sin indicar sentido la placa queda como `ambos`', async () => {
    await vincular(MAC_1, CLAVE_1);
    expect(await sentidosDeLaPuerta()).toEqual(['ambos']);
  });

  it('el sentido de la solicitud llega al dispositivo al pulsar el botón', async () => {
    await vincular(MAC_1, CLAVE_1, 'salida');
    expect(await sentidosDeLaPuerta()).toEqual(['salida']);
  });

  it('`entrada` y luego `salida` en la misma puerta conviven: dos placas, una por lado', async () => {
    await vincular(MAC_1, CLAVE_1, 'entrada');
    await vincular(MAC_2, CLAVE_2, 'salida');
    expect(await sentidosDeLaPuerta()).toEqual(['entrada', 'salida']);
  });

  describe('conflictos (409)', () => {
    it('`ambos` y luego `entrada`: dispositivo.sentido_en_conflicto, y no queda solicitud', async () => {
      await vincular(MAC_1, CLAVE_1, 'ambos');
      const id = await placa(MAC_2, CLAVE_2);

      const respuesta = await pedir(id, 'entrada');

      expect(respuesta.statusCode).toBe(409);
      expect(respuesta.json<Problema>().code).toBe('dispositivo.sentido_en_conflicto');
      expect((await anunciar(MAC_2, CLAVE_2)).json()).toEqual({ estado: 'detectada' });
      expect(await sentidosDeLaPuerta()).toEqual(['ambos']);
    });

    it('`entrada` y luego `ambos`: dispositivo.sentido_en_conflicto', async () => {
      await vincular(MAC_1, CLAVE_1, 'entrada');
      const respuesta = await pedir(await placa(MAC_2, CLAVE_2), 'ambos');
      expect(respuesta.statusCode).toBe(409);
      expect(respuesta.json<Problema>().code).toBe('dispositivo.sentido_en_conflicto');
    });

    it('el mismo lado dos veces: puerta.con_dispositivo', async () => {
      await vincular(MAC_1, CLAVE_1, 'entrada');
      const respuesta = await pedir(await placa(MAC_2, CLAVE_2), 'entrada');
      expect(respuesta.statusCode).toBe(409);
      expect(respuesta.json<Problema>().code).toBe('puerta.con_dispositivo');
    });

    it('si dos solicitudes que cabían cuando se pidieron chocan al confirmar, la segunda NO se vincula', async () => {
      // Ambas se piden con la puerta vacía (cada una cabe sola); `ambos` confirma primero.
      const uno = await placa(MAC_1, CLAVE_1);
      const dos = await placa(MAC_2, CLAVE_2);
      expect((await pedir(uno, 'ambos')).statusCode).toBe(202);
      expect((await pedir(dos, 'entrada')).statusCode).toBe(202);
      expect((await confirmar(MAC_1, CLAVE_1)).statusCode).toBe(200);

      const segunda = await confirmar(MAC_2, CLAVE_2);

      expect(segunda.statusCode).toBe(409);
      expect(segunda.json<Problema>().code).toBe('dispositivo.sentido_en_conflicto');
      expect(await sentidosDeLaPuerta()).toEqual(['ambos']);
    });
  });

  describe('cuerpo y listado', () => {
    it('un sentido que no existe es 400', async () => {
      const respuesta = await pedir(await placa(MAC_1, CLAVE_1), 'diagonal');
      expect(respuesta.statusCode).toBe(400);
    });

    it('un campo que no existe en el cuerpo sigue siendo 400 (esquema estricto)', async () => {
      const respuesta = await plataforma(
        'POST',
        `/placas/${await placa(MAC_1, CLAVE_1)}/vincular`,
        {
          cuenta_id: a.cuenta.id,
          puerta_id: puerta,
          nombre: 'Lector',
          direccion: 'entrada',
        },
      );
      expect(respuesta.statusCode).toBe(400);
    });

    it('el listado muestra `vinculo_sentido` mientras la placa espera el botón y `dispositivo.sentido` después', async () => {
      const id = await placa(MAC_1, CLAVE_1);
      const lista = async () =>
        (await plataforma('GET', '/placas'))
          .json<{
            datos: {
              id: string;
              vinculo_sentido: Sentido | null;
              dispositivo: { sentido: Sentido } | null;
            }[];
          }>()
          .datos.find((fila) => fila.id === id);

      expect(await lista()).toMatchObject({ vinculo_sentido: null, dispositivo: null });
      await pedir(id, 'salida');
      expect(await lista()).toMatchObject({ vinculo_sentido: 'salida', dispositivo: null });
      await confirmar(MAC_1, CLAVE_1);
      expect(await lista()).toMatchObject({
        vinculo_sentido: null,
        dispositivo: { sentido: 'salida' },
      });
    });

    it('cancelar el vínculo limpia también el sentido pedido', async () => {
      const id = await placa(MAC_1, CLAVE_1);
      await pedir(id, 'entrada');
      expect((await plataforma('POST', `/placas/${id}/cancelar-vinculo`)).statusCode).toBe(204);
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT vinculo_sentido, vinculo_puerta_id FROM placas WHERE id = ?',
        [id],
      );
      expect(filas[0]).toMatchObject({ vinculo_sentido: null, vinculo_puerta_id: null });
    });

    it('una solicitud anterior a la ubicación del lector (sentido nulo) se vincula como `ambos`', async () => {
      const id = await placa(MAC_1, CLAVE_1);
      await pedir(id);
      await prueba.pool.query('UPDATE placas SET vinculo_sentido = NULL WHERE id = ?', [id]);
      expect((await confirmar(MAC_1, CLAVE_1)).statusCode).toBe(200);
      expect(await sentidosDeLaPuerta()).toEqual(['ambos']);
    });
  });
});
