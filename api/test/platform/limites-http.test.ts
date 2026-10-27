import type { RowDataPacket } from 'mysql2/promise';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  crearEscenario,
  crearQr,
  type DispositivoDePrueba,
  type Escenario,
} from '../helpers/fixtures.js';
import { conUsuario, iniciarSesion } from '../helpers/http.js';

/** Rate limit por ruta (ADR 0030 §3.2): clave correcta, 429 con `Retry-After` y la validación sin tocar. */
describe('límites de uso de la API', () => {
  let prueba: AppDePrueba | null = null;
  let a: Escenario;
  let b: Escenario;

  /** Abre la API con ciertos límites; el resto sigue "sin límite" (ver `test/setup.ts`). */
  async function abrir(entorno: Record<string, string>): Promise<AppDePrueba> {
    prueba = await crearAppDePrueba(undefined, entorno);
    await reiniciarBase(prueba.pool);
    a = await crearEscenario(prueba.pool, 'AAA');
    b = await crearEscenario(prueba.pool, 'BBB');
    return prueba;
  }

  afterEach(async () => {
    await prueba?.cerrar();
    prueba = null;
  });
  beforeEach(() => {
    prueba = null;
  });

  const loginIncorrecto = (p: AppDePrueba, remoteAddress?: string) =>
    p.app.inject({
      method: 'POST',
      url: '/api/v1/sesiones',
      payload: { pin: 'ZZZ9999' },
      ...(remoteAddress === undefined ? {} : { remoteAddress }),
    });

  const generar = (p: AppDePrueba, acceso: string, puertaId: string) =>
    p.app.inject({
      method: 'POST',
      url: '/api/v1/qr-accesos',
      headers: conUsuario({ acceso }),
      payload: { puerta_ids: [puertaId] },
    });

  const validar = (p: AppDePrueba, dispositivo: DispositivoDePrueba, token: string) =>
    p.app.inject({
      method: 'POST',
      url: '/api/v1/dispositivos/validaciones',
      headers: { authorization: dispositivo.encabezado },
      payload: { token },
    });

  it('el login se limita por IP: pasado el tope responde 429 limite.excedido con Retry-After', async () => {
    const p = await abrir({ LIMITE_LOGIN_POR_MINUTO: '3' });
    for (let i = 0; i < 3; i += 1) {
      expect((await loginIncorrecto(p)).statusCode).not.toBe(429);
    }
    const excedido = await loginIncorrecto(p);
    expect(excedido.statusCode).toBe(429);
    expect(excedido.json()).toMatchObject({ code: 'limite.excedido', status: 429 });
    expect(excedido.headers['content-type']).toContain('application/problem+json');
    expect(Number(excedido.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    expect(Number(excedido.headers['retry-after'])).toBeLessThanOrEqual(60);
    expect(excedido.json<{ reintentar_en_segundos: number }>().reintentar_en_segundos).toBe(
      Number(excedido.headers['retry-after']),
    );
    // Las cabeceras de seguridad de toda respuesta (ADR 0033) también salen en el 429.
    expect(excedido.headers['cache-control']).toBe('no-store');
    expect(String(excedido.headers.vary)).toMatch(/authorization/i);

    // Otra IP tiene su propia cuenta.
    expect((await loginIncorrecto(p, '10.9.9.9')).statusCode).not.toBe(429);
  });

  it('el 429 de un usuario no toca a otro usuario ni a otra cuenta (la clave es el usuario)', async () => {
    const p = await abrir({ LIMITE_GENERAR_QR_POR_MINUTO: '2' });
    const usuarioA = await iniciarSesion(p.app, a.usuario.pin);
    const adminA = await iniciarSesion(p.app, a.administrador.pin);
    const usuarioB = await iniciarSesion(p.app, b.usuario.pin);

    expect((await generar(p, usuarioA.acceso, a.puertaPrincipal.id)).statusCode).toBe(201);
    expect((await generar(p, usuarioA.acceso, a.puertaPrincipal.id)).statusCode).toBe(201);
    const excedido = await generar(p, usuarioA.acceso, a.puertaPrincipal.id);
    expect(excedido.statusCode).toBe(429);
    expect(excedido.json()).toMatchObject({ code: 'limite.excedido' });
    expect(Number(excedido.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    // El cuerpo del error no lleva nada de la cuenta ni del usuario.
    expect(Object.keys(excedido.json<object>()).sort()).toEqual([
      'code',
      'reintentar_en_segundos',
      'status',
      'title',
      'type',
    ]);

    // Otro usuario de la misma cuenta y un usuario de otra cuenta siguen generando.
    expect((await generar(p, adminA.acceso, a.puertaPrincipal.id)).statusCode).toBe(201);
    expect((await generar(p, usuarioB.acceso, b.puertaPrincipal.id)).statusCode).toBe(201);
    // El usuario limitado puede seguir leyendo: el tope es solo de la ruta de generar.
    const lectura = await p.app.inject({
      method: 'GET',
      url: '/api/v1/qr-accesos',
      headers: conUsuario(usuarioA),
    });
    expect(lectura.statusCode).toBe(200);
  });

  it('las lecturas y las escrituras tienen su propio tope por usuario', async () => {
    const p = await abrir({ LIMITE_LECTURA_POR_MINUTO: '2', LIMITE_ESCRITURA_POR_MINUTO: '1' });
    const sesion = await iniciarSesion(p.app, a.administrador.pin);
    const listar = () =>
      p.app.inject({ method: 'GET', url: '/api/v1/qr-accesos', headers: conUsuario(sesion) });
    expect((await listar()).statusCode).toBe(200);
    expect((await listar()).statusCode).toBe(200);
    expect((await listar()).statusCode).toBe(429);

    const anular = () =>
      p.app.inject({
        method: 'POST',
        url: '/api/v1/qr-accesos/999999/anulacion',
        headers: conUsuario(sesion),
      });
    expect((await anular()).statusCode).toBe(404);
    expect((await anular()).statusCode).toBe(429);
  });

  it('validar un QR NO se limita por el rate limit de usuario: con todos los topes de usuario agotados, la puerta abre', async () => {
    const p = await abrir({
      LIMITE_GENERAR_QR_POR_MINUTO: '1',
      LIMITE_ESCRITURA_POR_MINUTO: '1',
      LIMITE_LECTURA_POR_MINUTO: '1',
      LIMITE_LOGIN_POR_MINUTO: '1',
    });
    const sesion = await iniciarSesion(p.app, a.usuario.pin);
    // Agota generar y leer del usuario.
    expect((await generar(p, sesion.acceso, a.puertaPrincipal.id)).statusCode).toBe(201);
    expect((await generar(p, sesion.acceso, a.puertaPrincipal.id)).statusCode).toBe(429);
    for (let i = 0; i < 2; i += 1) {
      await p.app.inject({ method: 'GET', url: '/api/v1/qr-accesos', headers: conUsuario(sesion) });
    }

    // El dispositivo valida muchos QR seguidos: todos 200 y todos abren.
    for (let i = 0; i < 8; i += 1) {
      const qr = await crearQr(p.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
      const respuesta = await validar(p, a.dispositivoPrincipal, qr.texto);
      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.json()).toMatchObject({ abrir: true });
    }
  });

  it('la validación se protege del flood por credencial de dispositivo, sin consumir el QR y sin afectar a otro dispositivo', async () => {
    // 60 es el mínimo que admite la configuración: un lector que relee cada segundo no lo toca.
    const p = await abrir({ LIMITE_VALIDACION_POR_MINUTO: '60' });
    const usado = await crearQr(p.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
    const intacto = await crearQr(p.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
    // Las 60 lecturas del lector (la primera abre; las demás son `qr.usado`) pasan todas.
    for (let i = 0; i < 60; i += 1) {
      expect((await validar(p, a.dispositivoPrincipal, usado.texto)).statusCode).toBe(200);
    }
    const excedido = await validar(p, a.dispositivoPrincipal, intacto.texto);
    expect(excedido.statusCode).toBe(429);
    expect(excedido.json()).toMatchObject({ code: 'limite.excedido' });
    expect(excedido.json()).not.toHaveProperty('abrir');
    expect(Number(excedido.headers['retry-after'])).toBeGreaterThanOrEqual(1);

    // Falla segura: el 429 llegó antes de consumir nada ni de dejar un evento.
    const [filas] = await p.pool.query<RowDataPacket[]>(
      'SELECT usado_at FROM qr_accesos WHERE id = ?',
      [intacto.id],
    );
    expect(filas[0]?.usado_at).toBeNull();

    // Otro dispositivo (otra puerta, misma cuenta) y uno de otra cuenta tienen su propia cuenta.
    const otroQr = await crearQr(p.pool, a.cuenta, a.usuario.id, [a.puertaTrasera.id]);
    expect((await validar(p, a.dispositivoTrasero, otroQr.texto)).statusCode).toBe(200);
    const qrDeB = await crearQr(p.pool, b.cuenta, b.usuario.id, [b.puertaPrincipal.id]);
    expect((await validar(p, b.dispositivoPrincipal, qrDeB.texto)).statusCode).toBe(200);
  });

  it('las confirmaciones de apertura cuentan en el límite del dispositivo y nunca frenan la validación (ADR 0031 §18)', async () => {
    const p = await abrir({ LIMITE_DISPOSITIVO_POR_MINUTO: '3' });
    const qr = await crearQr(p.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
    const abierta = (await validar(p, a.dispositivoPrincipal, qr.texto)).json<{
      evento_id: string;
    }>();
    const confirmar = () =>
      p.app.inject({
        method: 'POST',
        url: '/api/v1/dispositivos/confirmaciones',
        headers: { authorization: a.dispositivoPrincipal.encabezado },
        payload: { evento_id: abierta.evento_id, resultado: 'ejecutada' },
      });
    for (let i = 0; i < 3; i += 1) expect((await confirmar()).statusCode).toBe(204);
    const excedido = await confirmar();
    expect(excedido.statusCode).toBe(429);
    expect(excedido.json()).toMatchObject({ code: 'limite.excedido' });
    expect(Number(excedido.headers['retry-after'])).toBeGreaterThanOrEqual(1);

    // La validación del MISMO dispositivo sigue abriendo: su límite es otro y no se contagia.
    const otro = await crearQr(p.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
    const validacion = await validar(p, a.dispositivoPrincipal, otro.texto);
    expect(validacion.statusCode).toBe(200);
    expect(validacion.json()).toMatchObject({ abrir: true });
  });

  it('con los valores por defecto, una ráfaga de lecturas del lector no se corta', async () => {
    const p = await abrir({ LIMITE_VALIDACION_POR_MINUTO: '600' });
    const qr = await crearQr(p.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
    // El lector relee el mismo texto muchas veces: la primera abre y el resto es `qr.usado`, nunca 429.
    for (let i = 0; i < 40; i += 1) {
      expect((await validar(p, a.dispositivoPrincipal, qr.texto)).statusCode).toBe(200);
    }
  });

  it('el anuncio de placas, sin sesión, se limita por IP', async () => {
    const p = await abrir({ LIMITE_ANUNCIO_POR_MINUTO: '2' });
    const anunciar = (remoteAddress?: string) =>
      p.app.inject({
        method: 'POST',
        url: '/api/v1/dispositivos/anunciar',
        payload: { mac: 'AA:BB:CC:DD:EE:01', clave: 'x'.repeat(32), firmware: '1.0.0' },
        ...(remoteAddress === undefined ? {} : { remoteAddress }),
      });
    expect((await anunciar()).statusCode).not.toBe(429);
    expect((await anunciar()).statusCode).not.toBe(429);
    const excedido = await anunciar();
    expect(excedido.statusCode).toBe(429);
    expect(excedido.json()).toMatchObject({ code: 'limite.excedido' });
    expect((await anunciar('10.8.8.8')).statusCode).not.toBe(429);
  });
});
