import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  crearDispositivo,
  crearEscenario,
  marcarEnLinea,
  type DispositivoDePrueba,
  type Escenario,
} from '../helpers/fixtures.js';
import { iniciarSesion, type Sesion } from '../helpers/http.js';
import { ENTORNO_DE_ORDENES, espera, ordenDe } from '../helpers/ordenes.js';

/**
 * La petición larga de órdenes con un servidor HTTP REAL (`app.listen` + `fetch`), como exige el ADR 0032: con
 * `app.inject()` no hay socket, no se corta una conexión ni se ve el plazo propio de la ruta. Acá se comprueba lo que
 * el ADR 0035 §2 promete: la espera NO ocupa conexiones del pool, el plazo de la ruta NO es el de 2,5 s de las demás,
 * una conexión cortada limpia su espera y una orden despierta a la placa en menos de un segundo.
 */
describe('GET /dispositivos/ordenes con un servidor HTTP real (ADR 0032 §1, ADR 0035 §2)', () => {
  let prueba: AppDePrueba | undefined;
  let url = '';
  let a: Escenario;
  let sesion: Sesion;
  let segundaPlaca: DispositivoDePrueba;

  async function levantar(entorno: Record<string, string> = {}): Promise<AppDePrueba> {
    const p = await crearAppDePrueba(undefined, {
      ...ENTORNO_DE_ORDENES,
      // Más larga que los 2,5 s de las rutas del dispositivo (se comprueba más abajo) y con un sondeo lento: lo que
      // despierte a la placa antes de 3 s es la señal en memoria, no el sondeo.
      ORDENES_ESPERA_MS: '3200',
      ORDENES_SONDEO_MS: '3000',
      PETICION_MS_ORDENES: '5000',
      ...entorno,
    });
    prueba = p;
    await reiniciarBase(p.pool);
    a = await crearEscenario(p.pool, 'AAA');
    await p.pool.query("UPDATE dispositivos SET sentido = 'salida' WHERE id = ?", [
      a.dispositivoPrincipal.id,
    ]);
    segundaPlaca = await crearDispositivo(p.pool, a.cuenta, a.puertaPrincipal.id, {
      sentido: 'entrada',
    });
    await marcarEnLinea(p.pool, a.dispositivoPrincipal.id);
    await marcarEnLinea(p.pool, segundaPlaca.id);
    sesion = await iniciarSesion(p.app, a.usuario.pin);
    await p.app.listen({ port: 0, host: '127.0.0.1' });
    url = `http://127.0.0.1:${(p.app.server.address() as AddressInfo).port}/api/v1`;
    return p;
  }

  beforeEach(() => {
    prueba = undefined;
  });
  afterEach(async () => {
    await prueba?.cerrar();
  });

  const preguntar = (placa: DispositivoDePrueba, señal?: AbortSignal): Promise<Response> =>
    fetch(`${url}/dispositivos/ordenes`, {
      headers: { authorization: placa.encabezado },
      ...(señal === undefined ? {} : { signal: señal }),
    });
  const abrirDesdeLaApp = (puertaId: string): Promise<Response> =>
    fetch(`${url}/puertas/${puertaId}/abrir`, {
      method: 'POST',
      headers: { authorization: `Bearer ${sesion.acceso}`, 'idempotency-key': randomUUID() },
    });

  it('la espera NO consume conexiones del pool: con el pool reservado en 2, varias esperas simultáneas no lo agotan', async () => {
    const p = await levantar({ DB_POOL_DISPOSITIVOS: '2' });

    // Seis placas esperando a la vez, con un pool de dos conexiones: si cada espera retuviera una, el resto
    // (y toda la puerta) quedaría sin conexión.
    const esperas = Array.from({ length: 6 }, () => preguntar(a.dispositivoPrincipal));
    await espera(300);

    // Mientras tanto el pool reservado sigue atendiendo: configuración, latido y validación, rápido y sin 503.
    const inicio = Date.now();
    const configuracion = await fetch(`${url}/dispositivos/configuracion`, {
      headers: { authorization: a.dispositivoTrasero.encabezado },
    });
    expect(configuracion.status).toBe(200);
    const latido = await fetch(`${url}/dispositivos/latidos`, {
      method: 'POST',
      headers: {
        authorization: a.dispositivoTrasero.encabezado,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ firmware: '1.0.0', rssi: -60, puerta_abierta: false }),
    });
    expect(latido.status).toBe(204);
    const validacion = await fetch(`${url}/dispositivos/validaciones`, {
      method: 'POST',
      headers: {
        authorization: a.dispositivoTrasero.encabezado,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ token: 'no-es-un-qr' }),
    });
    expect(validacion.status).toBe(200);
    expect(Date.now() - inicio).toBeLessThan(1500);

    // Las conexiones realmente abiertas por el pool de dispositivos nunca pasaron de su tope.
    const interno = p.poolDispositivos as unknown as {
      pool: { _allConnections: { length: number } };
    };
    expect(interno.pool._allConnections.length).toBeLessThanOrEqual(2);

    // Y ninguna espera falló por falta de conexión: todas terminan en 204 al vencer su espera.
    for (const respuesta of await Promise.all(esperas)) expect(respuesta.status).toBe(204);
  });

  it('la ruta tiene su propio plazo: retiene más de los 2,5 s de las demás rutas del dispositivo y no responde 503', async () => {
    await levantar();
    const inicio = Date.now();
    const respuesta = await preguntar(a.dispositivoPrincipal);
    expect(respuesta.status).toBe(204);
    expect(Date.now() - inicio).toBeGreaterThanOrEqual(3000);
  });

  it('una orden despierta a la placa en menos de un segundo, sin esperar al sondeo (que es de 3 s)', async () => {
    await levantar();
    const pregunta = preguntar(a.dispositivoPrincipal);
    await espera(300);

    const inicio = Date.now();
    const orden = (await (await abrirDesdeLaApp(a.puertaPrincipal.id)).json()) as {
      orden_id: string;
    };
    const respuesta = await pregunta;

    expect(respuesta.status).toBe(200);
    expect(Date.now() - inicio).toBeLessThan(1000);
    expect(((await respuesta.json()) as { orden_id: string }).orden_id).toBe(orden.orden_id);
  });

  it('si la placa corta la conexión, su espera se limpia: una orden nueva no se entrega a una placa que ya no escucha', async () => {
    const p = await levantar();
    const corte = new AbortController();
    const fantasma = preguntar(a.dispositivoPrincipal, corte.signal).catch(() => 'cortada');
    await espera(300);
    corte.abort();
    expect(await fantasma).toBe('cortada');
    await espera(300);

    const orden = (await (await abrirDesdeLaApp(a.puertaPrincipal.id)).json()) as {
      orden_id: string;
    };
    await espera(500);

    // Si la espera cortada siguiera viva, habría tomado la orden y la daría por entregada a nadie.
    expect(await ordenDe(p.pool, orden.orden_id)).toMatchObject({
      estado: 'pendiente',
      dispositivo_id: null,
    });
    // La orden sigue disponible: la otra placa de la puerta la recibe.
    const respuesta = await preguntar(segundaPlaca);
    expect(respuesta.status).toBe(200);
    expect(((await respuesta.json()) as { orden_id: string }).orden_id).toBe(orden.orden_id);
  });

  it('con una sola conexión cortada a mitad de la espera y otra placa esperando, la orden va a la que sigue escuchando', async () => {
    const p = await levantar();
    const corte = new AbortController();
    const cortada = preguntar(a.dispositivoPrincipal, corte.signal).catch(() => 'cortada');
    const viva = preguntar(segundaPlaca);
    await espera(300);
    corte.abort();
    await cortada;
    await espera(200);

    const orden = (await (await abrirDesdeLaApp(a.puertaPrincipal.id)).json()) as {
      orden_id: string;
    };
    const respuesta = await viva;

    expect(respuesta.status).toBe(200);
    expect(await ordenDe(p.pool, orden.orden_id)).toMatchObject({
      dispositivo_id: segundaPlaca.id,
    });
  });
});
