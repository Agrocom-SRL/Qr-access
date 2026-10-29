import { describe, expect, it } from 'vitest';
import { NotificadorPorClave } from '../../src/platform/espera/notificador-por-clave.js';

const espera = (ms: number): Promise<void> => new Promise((resolver) => setTimeout(resolver, ms));

/** El despertador en memoria de las peticiones largas (ADR 0035 §2): sin base, sin conexiones. */
describe('NotificadorPorClave', () => {
  it('despertar suelta a quien espera esa clave y a nadie más', async () => {
    const notificador = new NotificadorPorClave();
    const uno = notificador.suscribir('1:10');
    const otraPuerta = notificador.suscribir('1:11');
    const inicio = Date.now();
    let otroDespierto = false;
    void otraPuerta.esperar(5_000).then(() => {
      otroDespierto = true;
    });

    const esperando = uno.esperar(5_000);
    expect(notificador.despertar('1:10')).toBe(1);
    await esperando;

    expect(Date.now() - inicio).toBeLessThan(500);
    await espera(20);
    expect(otroDespierto).toBe(false);
    uno.cerrar();
    otraPuerta.cerrar();
  });

  it('una señal que llega ANTES de esperar no se pierde: la siguiente espera termina al instante', async () => {
    const notificador = new NotificadorPorClave();
    const suscripcion = notificador.suscribir('1:10');
    notificador.despertar('1:10');

    const inicio = Date.now();
    await suscripcion.esperar(5_000);
    expect(Date.now() - inicio).toBeLessThan(200);

    // Y la señal se consumió: la espera siguiente sí espera.
    const segunda = Date.now();
    await suscripcion.esperar(80);
    expect(Date.now() - segunda).toBeGreaterThanOrEqual(60);
    suscripcion.cerrar();
  });

  it('despierta a todos los que esperan la misma clave (dos placas de una puerta)', async () => {
    const notificador = new NotificadorPorClave();
    const uno = notificador.suscribir('1:10');
    const dos = notificador.suscribir('1:10');
    const esperas = Promise.all([uno.esperar(5_000), dos.esperar(5_000)]);
    expect(notificador.despertar('1:10')).toBe(2);
    await esperas;
    uno.cerrar();
    dos.cerrar();
  });

  it('el vencimiento termina la espera sin señal', async () => {
    const notificador = new NotificadorPorClave();
    const suscripcion = notificador.suscribir('1:10');
    const inicio = Date.now();
    await suscripcion.esperar(60);
    expect(Date.now() - inicio).toBeGreaterThanOrEqual(50);
    suscripcion.cerrar();
  });

  it('abortar la petición (la placa cortó) termina la espera y cerrar libera la clave', async () => {
    const notificador = new NotificadorPorClave();
    const corte = new AbortController();
    const suscripcion = notificador.suscribir('1:10', corte.signal);
    expect(notificador.cantidad('1:10')).toBe(1);

    const esperando = suscripcion.esperar(5_000);
    corte.abort();
    const inicio = Date.now();
    await esperando;
    expect(Date.now() - inicio).toBeLessThan(200);

    suscripcion.cerrar();
    expect(notificador.cantidad('1:10')).toBe(0);
    expect(notificador.despertar('1:10')).toBe(0);
  });

  it('una suscripción ya abortada no espera; cerrar dos veces no falla ni deja rastro', async () => {
    const notificador = new NotificadorPorClave();
    const corte = new AbortController();
    corte.abort();
    const suscripcion = notificador.suscribir('1:10', corte.signal);
    const inicio = Date.now();
    await suscripcion.esperar(5_000);
    expect(Date.now() - inicio).toBeLessThan(200);
    suscripcion.cerrar();
    suscripcion.cerrar();
    expect(notificador.cantidad('1:10')).toBe(0);
  });

  it('despertar una clave sin nadie esperando no hace nada', () => {
    expect(new NotificadorPorClave().despertar('1:99')).toBe(0);
  });
});
