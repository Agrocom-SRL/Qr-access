import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { crearEscenario, crearSuperAdmin } from '../helpers/fixtures.js';
import {
  conUsuario,
  iniciarSesionDePlataforma,
  PNG_DE_PRUEBA,
  respaldoDePago,
  type Problema,
} from '../helpers/http.js';

const BASE = '/api/v1/plataforma';

describe('plataforma: comprobantes de pago (ADR 0024)', () => {
  let prueba: AppDePrueba;
  let headers: { authorization: string };
  let cuentaId: string;

  beforeEach(async () => {
    prueba = await crearAppDePrueba();
    await reiniciarBase(prueba.pool);
    const lucia = await crearSuperAdmin(prueba.pool, 'lucia.paz', { nombre: 'Lucía Paz' });
    headers = conUsuario(
      await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', lucia.contrasena),
    );
    cuentaId = (await crearEscenario(prueba.pool, 'AAA')).cuenta.id;
  });
  afterEach(async () => {
    await prueba.cerrar();
  });

  const subir = (contenido: Buffer, tipo = 'image/png') =>
    prueba.app.inject({
      method: 'POST',
      url: `${BASE}/comprobantes`,
      headers: { ...headers, 'content-type': tipo },
      payload: contenido,
    });

  it('guarda el archivo y lo devuelve igual por la API, con el tipo detectado', async () => {
    const respuesta = await subir(PNG_DE_PRUEBA);
    expect(respuesta.statusCode, respuesta.body).toBe(201);
    const { id, tipo_mime } = respuesta.json<{ id: string; tipo_mime: string }>();
    expect(tipo_mime).toBe('image/png');

    const leido = await prueba.app.inject({
      method: 'GET',
      url: `${BASE}/comprobantes/${id}`,
      headers,
    });
    expect(leido.statusCode).toBe(200);
    expect(leido.headers['content-type']).toContain('image/png');
    expect(leido.headers['x-content-type-options']).toBe('nosniff');
    expect(leido.rawPayload.equals(PNG_DE_PRUEBA)).toBe(true);
  });

  it('decide el tipo por los bytes: un ejecutable que se declara imagen se rechaza', async () => {
    const respuesta = await subir(Buffer.from('MZ\u0090\u0000 no soy una imagen'));
    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json<Problema>().code).toBe('comprobante.formato_invalido');
  });

  it('rechaza un archivo de más de 5 MB y un tipo no permitido', async () => {
    const grande = await subir(Buffer.concat([PNG_DE_PRUEBA, Buffer.alloc(5 * 1024 * 1024)]));
    expect(grande.statusCode).toBe(413);
    const gif = await subir(Buffer.from('GIF89a'), 'image/gif');
    expect(gif.statusCode).toBe(415);
  });

  it('exige sesión de plataforma para subir y para leer', async () => {
    const sinSesion = await prueba.app.inject({
      method: 'POST',
      url: `${BASE}/comprobantes`,
      headers: { 'content-type': 'image/png' },
      payload: PNG_DE_PRUEBA,
    });
    expect(sinSesion.statusCode).toBe(401);
    const inexistente = await prueba.app.inject({
      method: 'GET',
      url: `${BASE}/comprobantes/999999`,
      headers,
    });
    expect(inexistente.statusCode).toBe(404);
    expect(inexistente.json<Problema>().code).toBe('comprobante.no_encontrado');
  });

  describe('en el pago', () => {
    const pagar = (cuerpo: Record<string, unknown>) =>
      prueba.app.inject({
        method: 'POST',
        url: `${BASE}/cuentas/${cuentaId}/pagos`,
        headers,
        payload: {
          tipo: 'renovacion',
          monto: 12000,
          fecha_pago: '2026-10-12',
          referencia: 'TRF-1',
          ...cuerpo,
        },
      });

    it('una transferencia o un depósito sin banco, cuenta y comprobante no se registran', async () => {
      for (const medio of ['transferencia', 'deposito']) {
        const respuesta = await pagar({ medio });
        expect(respuesta.statusCode, respuesta.body).toBe(400);
      }
    });

    it('un pago en efectivo no los necesita', async () => {
      const respuesta = await pagar({ medio: 'efectivo' });
      expect(respuesta.statusCode, respuesta.body).toBe(201);
    });

    it('guarda banco, cuenta y comprobante, y el historial los devuelve', async () => {
      const respaldo = await respaldoDePago(prueba.app, headers);
      const respuesta = await pagar({ medio: 'deposito', ...respaldo });
      expect(respuesta.statusCode, respuesta.body).toBe(201);
      const historial = (
        await prueba.app.inject({
          method: 'GET',
          url: `${BASE}/cuentas/${cuentaId}/suscripcion`,
          headers,
        })
      ).json<{
        pagos: { banco: string; cuenta_destino: string; comprobante_id: string }[];
      }>().pagos;
      expect(historial[0]).toMatchObject(respaldo);
    });

    it('un comprobante que no existe se rechaza', async () => {
      const respuesta = await pagar({
        medio: 'transferencia',
        banco: 'Banco Unión',
        cuenta_destino: '1',
        comprobante_id: '999999',
      });
      expect(respuesta.statusCode).toBe(422);
      expect(respuesta.json<Problema>().code).toBe('comprobante.no_encontrado');
    });
  });
});
