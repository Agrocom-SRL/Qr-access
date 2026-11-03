import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  crearDispositivo,
  crearEscenario,
  marcarEnLinea,
  type DispositivoDePrueba,
  type Escenario,
} from '../helpers/fixtures.js';
import { conUsuario, iniciarSesion, type Problema, type Sesion } from '../helpers/http.js';
import { crearOrdenDePrueba, ENTORNO_DE_ORDENES, espera, ordenDe } from '../helpers/ordenes.js';

interface OrdenRecibida {
  orden_id: string;
  valida_por_ms: number;
  segundos_apertura: number;
}

/**
 * `GET /dispositivos/ordenes` (ADR 0035 §2): la petición larga de la placa. Con `app.inject()` (los tiempos son
 * pequeños: espera de 600 ms); el servidor real, el pool y la desconexión están en
 * `ordenes-de-placa-servidor-real.test.ts` (ADR 0032).
 */
describe('GET /api/v1/dispositivos/ordenes: la placa recibe la orden de apertura (ADR 0035 §2)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let sesion: Sesion;
  /** La segunda placa de la puerta principal de A (la otra es `a.dispositivoPrincipal`). */
  let segundaPlaca: DispositivoDePrueba;

  beforeAll(async () => {
    prueba = await crearAppDePrueba(undefined, ENTORNO_DE_ORDENES);
  });
  afterAll(async () => {
    await prueba.cerrar();
  });
  beforeEach(async () => {
    await reiniciarBase(prueba.pool);
    a = await crearEscenario(prueba.pool, 'AAA');
    b = await crearEscenario(prueba.pool, 'BBB');
    // La puerta principal de A lleva dos placas: la de afuera y la de adentro.
    await prueba.pool.query("UPDATE dispositivos SET sentido = 'salida' WHERE id = ?", [
      a.dispositivoPrincipal.id,
    ]);
    segundaPlaca = await crearDispositivo(prueba.pool, a.cuenta, a.puertaPrincipal.id, {
      sentido: 'entrada',
    });
    for (const id of [
      a.dispositivoPrincipal.id,
      segundaPlaca.id,
      a.dispositivoTrasero.id,
      b.dispositivoPrincipal.id,
    ]) {
      await marcarEnLinea(prueba.pool, id);
    }
    sesion = await iniciarSesion(prueba.app, a.usuario.pin);
  });

  const preguntar = (placa: DispositivoDePrueba) =>
    prueba.app.inject({
      method: 'GET',
      url: '/api/v1/dispositivos/ordenes',
      headers: { authorization: placa.encabezado },
    });

  /** El usuario pide abrir desde la app: crea la orden y despierta a las placas que esperan. */
  const abrirDesdeLaApp = (puertaId: string) =>
    prueba.app.inject({
      method: 'POST',
      url: `/api/v1/puertas/${puertaId}/abrir`,
      headers: { ...conUsuario(sesion), 'idempotency-key': randomUUID() },
    });

  describe('la placa recibe la orden', () => {
    it('200 con la orden, el plazo RELATIVO restante y los segundos de apertura de la puerta', async () => {
      const orden = (await abrirDesdeLaApp(a.puertaPrincipal.id)).json<{ orden_id: string }>();

      const respuesta = await preguntar(a.dispositivoPrincipal);

      expect(respuesta.statusCode).toBe(200);
      const cuerpo = respuesta.json<OrdenRecibida>();
      // Sin hora absoluta ni sentido: solo lo que la placa necesita.
      expect(Object.keys(cuerpo).sort()).toEqual([
        'orden_id',
        'segundos_apertura',
        'valida_por_ms',
      ]);
      expect(cuerpo.orden_id).toBe(orden.orden_id);
      expect(cuerpo.segundos_apertura).toBe(6);
      expect(cuerpo.valida_por_ms).toBeGreaterThan(0);
      expect(cuerpo.valida_por_ms).toBeLessThanOrEqual(15_000);
      expect(Number.isInteger(cuerpo.valida_por_ms)).toBe(true);
      expect(respuesta.headers['cache-control']).toContain('no-store');

      const fila = await ordenDe(prueba.pool, orden.orden_id);
      expect(fila).toMatchObject({
        estado: 'entregada',
        dispositivo_id: a.dispositivoPrincipal.id,
      });
      expect(fila?.entregada_at).toBeInstanceOf(Date);
    });

    it('el plazo que recibe es lo que le queda a la orden, no la vigencia entera', async () => {
      const ahora = new Date();
      // Creada hace 10 s: le quedan ~5 s.
      await crearOrdenDePrueba(prueba.pool, a, a.puertaPrincipal.id, {
        creadaAt: new Date(ahora.getTime() - 10_000),
        venceAt: new Date(ahora.getTime() + 5_000),
      });

      const cuerpo = (await preguntar(a.dispositivoPrincipal)).json<OrdenRecibida>();

      expect(cuerpo.valida_por_ms).toBeLessThanOrEqual(5_000);
      expect(cuerpo.valida_por_ms).toBeGreaterThan(3_000);
    });

    it('204 si pasa la espera sin ninguna orden', async () => {
      const inicio = Date.now();
      const respuesta = await preguntar(a.dispositivoPrincipal);
      expect(respuesta.statusCode).toBe(204);
      expect(respuesta.body).toBe('');
      // Retuvo la petición hasta el final de la espera (600 ms), no respondió de inmediato.
      expect(Date.now() - inicio).toBeGreaterThanOrEqual(500);
    });

    it('una orden que llega mientras la placa espera la despierta al instante (sin esperar el final)', async () => {
      const inicio = Date.now();
      const espera204 = preguntar(a.dispositivoPrincipal);
      await espera(150);
      await abrirDesdeLaApp(a.puertaPrincipal.id);

      const respuesta = await espera204;

      expect(respuesta.statusCode).toBe(200);
      expect(Date.now() - inicio).toBeLessThan(550);
    });
  });

  describe('una orden se entrega una sola vez, y a una placa de SU puerta', () => {
    it('con DOS placas en la puerta solo una la recibe (carrera real)', async () => {
      const antes = [preguntar(a.dispositivoPrincipal), preguntar(segundaPlaca)];
      await espera(150);
      const orden = (await abrirDesdeLaApp(a.puertaPrincipal.id)).json<{ orden_id: string }>();

      const respuestas = await Promise.all(antes);

      expect(respuestas.map((r) => r.statusCode).sort()).toEqual([200, 204]);
      const ganadora = respuestas.find((r) => r.statusCode === 200);
      expect(ganadora?.json<OrdenRecibida>().orden_id).toBe(orden.orden_id);
      const fila = await ordenDe(prueba.pool, orden.orden_id);
      expect([a.dispositivoPrincipal.id, segundaPlaca.id]).toContain(String(fila?.dispositivo_id));
      expect(fila?.estado).toBe('entregada');
    });

    it('con muchas preguntas a la vez desde las dos placas la orden se entrega exactamente una vez', async () => {
      await crearOrdenDePrueba(prueba.pool, a, a.puertaPrincipal.id);
      const respuestas = await Promise.all(
        [a.dispositivoPrincipal, segundaPlaca, a.dispositivoPrincipal, segundaPlaca].map(preguntar),
      );
      expect(respuestas.filter((r) => r.statusCode === 200)).toHaveLength(1);
      expect(respuestas.filter((r) => r.statusCode === 204)).toHaveLength(3);
    });

    it('una orden ya entregada no se vuelve a entregar, ni a la otra placa ni a la misma', async () => {
      await crearOrdenDePrueba(prueba.pool, a, a.puertaPrincipal.id);
      expect((await preguntar(a.dispositivoPrincipal)).statusCode).toBe(200);
      expect((await preguntar(segundaPlaca)).statusCode).toBe(204);
      expect((await preguntar(a.dispositivoPrincipal)).statusCode).toBe(204);
    });

    it('la placa de OTRA puerta de la misma cuenta no la recibe', async () => {
      const orden = await crearOrdenDePrueba(prueba.pool, a, a.puertaPrincipal.id);

      expect((await preguntar(a.dispositivoTrasero)).statusCode).toBe(204);

      expect(await ordenDe(prueba.pool, orden.id)).toMatchObject({
        estado: 'pendiente',
        dispositivo_id: null,
      });
    });

    it('la placa de OTRA cuenta no la recibe (aislamiento)', async () => {
      const orden = await crearOrdenDePrueba(prueba.pool, a, a.puertaPrincipal.id);

      expect((await preguntar(b.dispositivoPrincipal)).statusCode).toBe(204);

      expect(await ordenDe(prueba.pool, orden.id)).toMatchObject({ estado: 'pendiente' });
    });

    it('la orden de la cuenta B no sale en la placa de A aunque compartan el número de puerta', async () => {
      // La orden de B existe y está vigente; la placa de A solo ve las de SU puerta.
      await crearOrdenDePrueba(prueba.pool, b, b.puertaPrincipal.id, { usuarioId: b.usuario.id });
      expect((await preguntar(a.dispositivoPrincipal)).statusCode).toBe(204);
      expect((await preguntar(b.dispositivoPrincipal)).statusCode).toBe(200);
    });
  });

  describe('lo que NO se entrega', () => {
    it('una orden vencida no se entrega', async () => {
      const ahora = Date.now();
      const orden = await crearOrdenDePrueba(prueba.pool, a, a.puertaPrincipal.id, {
        creadaAt: new Date(ahora - 20_000),
        venceAt: new Date(ahora - 5_000),
      });

      expect((await preguntar(a.dispositivoPrincipal)).statusCode).toBe(204);

      expect(await ordenDe(prueba.pool, orden.id)).toMatchObject({
        estado: 'pendiente',
        dispositivo_id: null,
      });
    });

    it('con el interruptor de la puerta apagado responde 204 de inmediato, sin retener la petición', async () => {
      const orden = await crearOrdenDePrueba(prueba.pool, a, a.puertaPrincipal.id);
      await prueba.pool.query('UPDATE puertas SET apertura_manual = 0 WHERE id = ?', [
        a.puertaPrincipal.id,
      ]);

      const inicio = Date.now();
      const respuesta = await preguntar(a.dispositivoPrincipal);

      expect(respuesta.statusCode).toBe(204);
      expect(Date.now() - inicio).toBeLessThan(300);
      // Ni siquiera entrega una orden que ya existía: con el modo apagado la placa no obedece nada.
      expect(await ordenDe(prueba.pool, orden.id)).toMatchObject({ estado: 'pendiente' });
    });

    it('si la espera arrancó apagada y se enciende después, la siguiente pregunta ya entrega', async () => {
      await prueba.pool.query('UPDATE puertas SET apertura_manual = 0 WHERE id = ?', [
        a.puertaPrincipal.id,
      ]);
      expect((await preguntar(a.dispositivoPrincipal)).statusCode).toBe(204);
      await prueba.pool.query('UPDATE puertas SET apertura_manual = 1 WHERE id = ?', [
        a.puertaPrincipal.id,
      ]);
      await crearOrdenDePrueba(prueba.pool, a, a.puertaPrincipal.id);
      expect((await preguntar(a.dispositivoPrincipal)).statusCode).toBe(200);
    });
  });

  describe('autenticación y límites', () => {
    it('un dispositivo revocado recibe 401', async () => {
      await prueba.pool.query('UPDATE dispositivos SET revocado_at = NOW(3) WHERE id = ?', [
        a.dispositivoPrincipal.id,
      ]);
      const respuesta = await preguntar(a.dispositivoPrincipal);
      expect(respuesta.statusCode).toBe(401);
      expect(respuesta.json<Problema>().code).toBe('dispositivo.credencial_invalida');
    });

    it('sin credencial, o con la sesión de un usuario, es 401: la ruta es solo del dispositivo', async () => {
      expect(
        (await prueba.app.inject({ method: 'GET', url: '/api/v1/dispositivos/ordenes' }))
          .statusCode,
      ).toBe(401);
      expect(
        (
          await prueba.app.inject({
            method: 'GET',
            url: '/api/v1/dispositivos/ordenes',
            headers: conUsuario(sesion),
          })
        ).statusCode,
      ).toBe(401);
    });

    it('una clave equivocada es 401 y no entrega nada', async () => {
      await crearOrdenDePrueba(prueba.pool, a, a.puertaPrincipal.id);
      const respuesta = await preguntar({
        ...a.dispositivoPrincipal,
        encabezado: `Dispositivo ${a.dispositivoPrincipal.id}.${'x'.repeat(43)}`,
      });
      expect(respuesta.statusCode).toBe(401);
    });
  });
});

/** El respaldo por sondeo: sin señal en memoria (otra instancia, un reinicio) la orden igual se encuentra. */
describe('GET /api/v1/dispositivos/ordenes: sondeo de respaldo', () => {
  let prueba: AppDePrueba;
  let a: Escenario;

  beforeAll(async () => {
    prueba = await crearAppDePrueba(undefined, {
      ...ENTORNO_DE_ORDENES,
      ORDENES_ESPERA_MS: '2000',
      ORDENES_SONDEO_MS: '150',
      PETICION_MS_ORDENES: '4000',
    });
  });
  afterAll(async () => {
    await prueba.cerrar();
  });
  beforeEach(async () => {
    await reiniciarBase(prueba.pool);
    a = await crearEscenario(prueba.pool, 'AAA');
  });

  it('una orden escrita sin pasar por la API (sin señal) se entrega en el siguiente sondeo, antes de que termine la espera', async () => {
    const inicio = Date.now();
    const pregunta = prueba.app.inject({
      method: 'GET',
      url: '/api/v1/dispositivos/ordenes',
      headers: { authorization: a.dispositivoPrincipal.encabezado },
    });
    await espera(200);
    await crearOrdenDePrueba(prueba.pool, a, a.puertaPrincipal.id);

    const respuesta = await pregunta;

    expect(respuesta.statusCode).toBe(200);
    expect(Date.now() - inicio).toBeLessThan(1000);
  });
});

/** Rate limit propio de la petición larga (clase `ordenes`): holgado para el uso legítimo, firme contra un bucle. */
describe('GET /api/v1/dispositivos/ordenes: rate limit propio', () => {
  let prueba: AppDePrueba;
  let a: Escenario;

  beforeAll(async () => {
    prueba = await crearAppDePrueba(undefined, {
      ...ENTORNO_DE_ORDENES,
      LIMITE_ORDENES_POR_MINUTO: '6',
      LIMITE_DISPOSITIVO_POR_MINUTO: '1000',
    });
  });
  afterAll(async () => {
    await prueba.cerrar();
  });
  beforeEach(async () => {
    await reiniciarBase(prueba.pool);
    a = await crearEscenario(prueba.pool, 'AAA');
    // Con el modo apagado la respuesta es inmediata: una placa que insistiera en bucle recibiría 204 a toda velocidad.
    await prueba.pool.query('UPDATE puertas SET apertura_manual = 0');
  });

  const preguntar = (encabezado: string) =>
    prueba.app.inject({
      method: 'GET',
      url: '/api/v1/dispositivos/ordenes',
      headers: { authorization: encabezado },
    });

  it('una placa que insiste en bucle recibe 429 con reintentar_en_segundos; su latido y su configuración no se ven afectados', async () => {
    for (let i = 0; i < 6; i += 1) {
      expect((await preguntar(a.dispositivoPrincipal.encabezado)).statusCode).toBe(204);
    }
    const excedida = await preguntar(a.dispositivoPrincipal.encabezado);
    expect(excedida.statusCode).toBe(429);
    expect(excedida.json<Problema & { reintentar_en_segundos: number }>()).toMatchObject({
      code: 'limite.excedido',
    });

    // El límite es de la clase `ordenes` y de ESA placa: la configuración y otra placa siguen atendidas.
    const configuracion = await prueba.app.inject({
      method: 'GET',
      url: '/api/v1/dispositivos/configuracion',
      headers: { authorization: a.dispositivoPrincipal.encabezado },
    });
    expect(configuracion.statusCode).toBe(200);
    expect((await preguntar(a.dispositivoTrasero.encabezado)).statusCode).toBe(204);
  });

  it('el valor por omisión (30 por minuto) deja muy holgado el uso legítimo de una pregunta cada ~20 s', async () => {
    const { cargarConfig } = await import('../../src/config.js');
    const limite = cargarConfig({
      DB_HOST: 'x',
      DB_DATABASE: 'x',
      DB_USERNAME: 'x',
      DB_PASSWORD: '',
      JWT_SECRETO: 's'.repeat(32),
      PIN_PIMIENTA: 's'.repeat(32),
      QR_IDEMPOTENCIA_CLAVE: 's'.repeat(32),
    }).LIMITE_ORDENES_POR_MINUTO;
    expect(limite).toBe(30);
    // Tres preguntas por minuto en reposo: diez veces menos que el tope.
    expect(limite / 3).toBeGreaterThanOrEqual(10);
  });
});
