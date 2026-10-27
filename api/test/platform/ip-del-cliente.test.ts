import { Writable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { PoolSaturado } from '../../src/platform/errores/servicio-no-disponible.js';
import { crearEscenario, crearQr, type Escenario } from '../helpers/fixtures.js';
import { iniciarSesion } from '../helpers/http.js';

class LogEnMemoria extends Writable {
  texto = '';
  override _write(trozo: Buffer, _codificacion: string, listo: () => void): void {
    this.texto += trozo.toString();
    listo();
  }
  lineas(): Record<string, unknown>[] {
    return this.texto
      .split('\n')
      .filter((linea) => linea.startsWith('{'))
      .map((linea) => JSON.parse(linea) as Record<string, unknown>);
  }
}

/** IP del cliente, rate limit y fallos de autenticación (ADR 0030 §3.2, ADR 0033). */
describe('IP del cliente y autenticaciones fallidas', () => {
  let prueba: AppDePrueba | null = null;
  let a: Escenario;
  let log: LogEnMemoria;

  async function abrir(entorno: Record<string, string>): Promise<AppDePrueba> {
    log = new LogEnMemoria();
    prueba = await crearAppDePrueba(log, { LOG_LEVEL: 'warn', ...entorno });
    await reiniciarBase(prueba.pool);
    a = await crearEscenario(prueba.pool, 'AAA');
    return prueba;
  }
  afterEach(async () => {
    await prueba?.cerrar();
    prueba = null;
  });

  const loginIncorrecto = (p: AppDePrueba, forwardedFor?: string, remoteAddress?: string) =>
    p.app.inject({
      method: 'POST',
      url: '/api/v1/sesiones',
      payload: { pin: 'ZZZ9999' },
      ...(forwardedFor === undefined ? {} : { headers: { 'x-forwarded-for': forwardedFor } }),
      ...(remoteAddress === undefined ? {} : { remoteAddress }),
    });

  describe('X-Forwarded-For falseado no cambia la clave del límite', () => {
    it('con un salto de confianza (por omisión) cuenta la última dirección: el prefijo inventado no sirve', async () => {
      const p = await abrir({ LIMITE_LOGIN_POR_MINUTO: '3' });
      // El proxy puso 10.1.1.1; el atacante antepone una IP distinta en cada intento.
      for (let i = 0; i < 3; i += 1) {
        expect((await loginIncorrecto(p, `9.9.9.${i}, 10.1.1.1`)).statusCode).not.toBe(429);
      }
      expect((await loginIncorrecto(p, '9.9.9.200, 10.1.1.1')).statusCode).toBe(429);
      // Otro cliente real (otra última dirección) tiene su propia cuenta.
      expect((await loginIncorrecto(p, '9.9.9.1, 10.2.2.2')).statusCode).not.toBe(429);
    });

    it('con TRUST_PROXY=0 se ignora la cabecera entera: cuenta la IP del socket', async () => {
      const p = await abrir({ LIMITE_LOGIN_POR_MINUTO: '3', TRUST_PROXY: '0' });
      for (let i = 0; i < 3; i += 1) {
        expect((await loginIncorrecto(p, `9.9.9.${i}`)).statusCode).not.toBe(429);
      }
      expect((await loginIncorrecto(p, '9.9.9.200')).statusCode).toBe(429);
      expect((await loginIncorrecto(p, '9.9.9.200', '10.9.9.9')).statusCode).not.toBe(429);
    });

    it('con una lista de redes solo se confía en la cabecera si el socket es de esa red', async () => {
      const p = await abrir({ LIMITE_LOGIN_POR_MINUTO: '2', TRUST_PROXY: '10.0.0.0/8' });
      // Socket fuera de la red de confianza: la cabecera se ignora, siempre la misma clave.
      await loginIncorrecto(p, '9.9.9.1', '203.0.113.5');
      await loginIncorrecto(p, '9.9.9.2', '203.0.113.5');
      expect((await loginIncorrecto(p, '9.9.9.3', '203.0.113.5')).statusCode).toBe(429);
      // Socket de confianza: la cabecera sí decide.
      expect((await loginIncorrecto(p, '9.9.9.4', '10.0.0.7')).statusCode).not.toBe(429);
    });

    it('la API no arranca con TRUST_PROXY=true', async () => {
      await expect(crearAppDePrueba(undefined, { TRUST_PROXY: 'true' })).rejects.toThrow(
        /TRUST_PROXY/,
      );
    });
  });

  describe('límite de autenticaciones fallidas por IP', () => {
    const conCredencial = (p: AppDePrueba, encabezado: string, remoteAddress?: string) =>
      p.app.inject({
        method: 'GET',
        url: '/api/v1/dispositivos/configuracion',
        headers: { authorization: encabezado },
        ...(remoteAddress === undefined ? {} : { remoteAddress }),
      });
    const falsa = (id: string) => `Dispositivo ${id}.${'x'.repeat(32)}`;

    it('pasado el tope una IP recibe 429 sin que se verifique su credencial, ni siquiera una buena', async () => {
      const p = await abrir({ LIMITE_FALLOS_AUTENTICACION_POR_MINUTO: '5' });
      for (let i = 0; i < 5; i += 1) {
        expect((await conCredencial(p, falsa(a.dispositivoTrasero.id))).statusCode).toBe(401);
      }
      const bloqueada = await conCredencial(p, a.dispositivoTrasero.encabezado);
      expect(bloqueada.statusCode).toBe(429);
      expect(bloqueada.json()).toMatchObject({ code: 'limite.excedido' });
      expect(Number(bloqueada.headers['retry-after'])).toBeGreaterThanOrEqual(1);
      expect(bloqueada.headers['cache-control']).toBe('no-store');

      // Otra IP no se ve afectada.
      expect((await conCredencial(p, a.dispositivoTrasero.encabezado, '10.7.7.7')).statusCode).toBe(
        200,
      );
      // Tampoco el login (ruta pública) de la IP bloqueada: el límite es del camino autenticado.
      expect((await loginIncorrecto(p)).statusCode).not.toBe(429);
    });

    it('un JWT inválido cuenta igual', async () => {
      const p = await abrir({ LIMITE_FALLOS_AUTENTICACION_POR_MINUTO: '5' });
      const jwtFalso = 'aaaa.bbbb.cccc';
      const pedir = () =>
        p.app.inject({
          method: 'GET',
          url: '/api/v1/qr-accesos',
          headers: { authorization: `Bearer ${jwtFalso}` },
        });
      for (let i = 0; i < 5; i += 1) expect((await pedir()).statusCode).toBe(401);
      expect((await pedir()).statusCode).toBe(429);
    });

    it('los aciertos no consumen el tope: un dispositivo legítimo no se bloquea a sí mismo', async () => {
      const p = await abrir({ LIMITE_FALLOS_AUTENTICACION_POR_MINUTO: '5' });
      for (let i = 0; i < 40; i += 1) {
        expect((await conCredencial(p, a.dispositivoPrincipal.encabezado)).statusCode).toBe(200);
      }
    });

    it('un dispositivo conocido de la IP sigue operando aunque un tercero la haya bloqueado', async () => {
      const p = await abrir({ LIMITE_FALLOS_AUTENTICACION_POR_MINUTO: '5' });
      // La placa ya autenticó bien desde esta IP.
      expect((await conCredencial(p, a.dispositivoPrincipal.encabezado)).statusCode).toBe(200);
      // Alguien detrás del mismo NAT adivina credenciales y bloquea la IP.
      for (let i = 0; i < 5; i += 1) {
        expect((await conCredencial(p, falsa('999999'))).statusCode).toBe(401);
      }
      expect((await conCredencial(p, falsa('999999'))).statusCode).toBe(429);
      // La placa conocida sigue entrando y puede validar.
      expect((await conCredencial(p, a.dispositivoPrincipal.encabezado)).statusCode).toBe(200);
      const qr = await crearQr(p.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
      const validacion = await p.app.inject({
        method: 'POST',
        url: '/api/v1/dispositivos/validaciones',
        headers: { authorization: a.dispositivoPrincipal.encabezado },
        payload: { token: qr.texto },
      });
      expect(validacion.json()).toMatchObject({ abrir: true });
      // Una placa que NO era conocida sí recibe el 429.
      expect((await conCredencial(p, a.dispositivoTrasero.encabezado)).statusCode).toBe(429);
    });

    it('un usuario con sesión válida no gasta el tope', async () => {
      const p = await abrir({ LIMITE_FALLOS_AUTENTICACION_POR_MINUTO: '5' });
      const sesion = await iniciarSesion(p.app, a.administrador.pin);
      for (let i = 0; i < 10; i += 1) {
        const r = await p.app.inject({
          method: 'GET',
          url: '/api/v1/qr-accesos',
          headers: { authorization: `Bearer ${sesion.acceso}` },
        });
        expect(r.statusCode).toBe(200);
      }
    });
  });

  describe('el log del 429 y del 503 de rutas del dispositivo', () => {
    it('el 429 de validación anota dispositivoId, puertaId y la clase, sin credenciales ni QR', async () => {
      const p = await abrir({ LIMITE_VALIDACION_POR_MINUTO: '60' });
      const qr = await crearQr(p.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
      let ultima = 200;
      for (let i = 0; i < 61; i += 1) {
        ultima = (
          await p.app.inject({
            method: 'POST',
            url: '/api/v1/dispositivos/validaciones',
            headers: { authorization: a.dispositivoPrincipal.encabezado },
            payload: { token: qr.texto },
          })
        ).statusCode;
      }
      expect(ultima).toBe(429);
      const linea = log.lineas().find((l) => l.msg === 'límite de uso excedido');
      expect(linea).toMatchObject({
        clase: 'validacion',
        dispositivoId: a.dispositivoPrincipal.id,
        puertaId: a.puertaPrincipal.id,
      });
      expect(log.texto).not.toContain(a.dispositivoPrincipal.clave);
      expect(log.texto).not.toContain(qr.texto);
    });

    it('el 503 anota dispositivoId, puertaId y el motivo del pool', async () => {
      const p = await abrir({
        DB_POOL_DISPOSITIVOS: '2',
        DB_COLA_DISPOSITIVOS: '1',
        DB_ESPERA_MS_DISPOSITIVOS: '100',
      });
      // La autenticación pasa; la consulta de la puerta encuentra el pool saturado.
      const original = p.poolDispositivos.query.bind(p.poolDispositivos) as (
        ...argumentos: unknown[]
      ) => Promise<unknown>;
      p.poolDispositivos.query = ((sql: unknown, ...resto: unknown[]) => {
        if (typeof sql === 'string' && sql.includes('FROM puertas')) {
          return Promise.reject(new PoolSaturado('cola_llena'));
        }
        return original(sql, ...resto);
      }) as typeof p.poolDispositivos.query;
      const r = await p.app.inject({
        method: 'GET',
        url: '/api/v1/dispositivos/configuracion',
        headers: { authorization: a.dispositivoPrincipal.encabezado },
      });
      expect(r.statusCode).toBe(503);
      const linea = log.lineas().find((l) => l.msg === 'servicio no disponible');
      expect(linea).toMatchObject({
        motivo: 'cola_llena',
        dispositivoId: a.dispositivoPrincipal.id,
        puertaId: a.puertaPrincipal.id,
      });
    });
  });
});
