import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { RowDataPacket } from 'mysql2/promise';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { crearEscenario, crearQr, type Escenario } from '../helpers/fixtures.js';

/**
 * Tests con un servidor REAL (`app.listen` + `fetch`/`http`), no `app.inject()`.
 *
 * Existen por un defecto que `inject()` no puede ver (ADR 0032, "Implementado"): Fastify aborta
 * `request.signal` con el evento `close` del `IncomingMessage`, y Node 22 lo emite en cuanto
 * termina de leer el cuerpo de un POST. Con un cliente HTTP real, la señal ya llegaba abortada al
 * handler y la validación de QR respondía 503 siempre (la puerta no abría nunca). `inject()` no
 * abre un socket, así que nunca emitía ese `close`.
 */

const espera = (ms: number): Promise<void> => new Promise((resolver) => setTimeout(resolver, ms));

interface Validacion {
  abrir: boolean;
  motivo_code: string;
}

describe('API con servidor HTTP real', () => {
  let prueba: AppDePrueba | undefined;
  let url = '';
  let a: Escenario;

  /** Levanta la API escuchando en un puerto libre. `entorno` pisa la configuración. */
  async function abrir(entorno: Record<string, string> = {}): Promise<AppDePrueba> {
    const p = await crearAppDePrueba(undefined, entorno);
    prueba = p;
    await reiniciarBase(p.pool);
    a = await crearEscenario(p.pool, 'AAA');
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

  const validar = (token: string): Promise<Response> =>
    fetch(`${url}/dispositivos/validaciones`, {
      method: 'POST',
      headers: {
        authorization: a.dispositivoPrincipal.encabezado,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ token, leido_en: new Date().toISOString() }),
    });

  async function usadoAt(p: AppDePrueba, qrId: string): Promise<Date | null> {
    const [filas] = await p.pool.query<RowDataPacket[]>(
      'SELECT usado_at FROM qr_accesos WHERE id = ?',
      [qrId],
    );
    return (filas[0]?.usado_at as Date | null | undefined) ?? null;
  }

  /** La base "tarda" `ms` justo antes de consumir el QR, con la transacción ya abierta. */
  function retrasarConsumo(p: AppDePrueba, ms: number): void {
    const original = p.poolDispositivos.getConnection.bind(p.poolDispositivos);
    p.poolDispositivos.getConnection = async () => {
      const conexion = await original();
      const query = conexion.query.bind(conexion) as (...a: unknown[]) => Promise<unknown>;
      conexion.query = (async (sql: unknown, ...resto: unknown[]) => {
        if (typeof sql === 'string' && sql.startsWith('UPDATE qr_accesos')) await espera(ms);
        return query(sql, ...resto);
      }) as typeof conexion.query;
      return conexion;
    };
  }

  describe('POST /dispositivos/validaciones', () => {
    it('con un cliente real y cuerpo: QR válido abre y el segundo uso se rechaza', async () => {
      const p = await abrir();
      const qr = await crearQr(p.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);

      const primera = await validar(qr.texto);
      expect(primera.status).toBe(200);
      expect(await primera.json()).toMatchObject({ abrir: true, motivo_code: 'acceso.permitido' });
      expect(await usadoAt(p, qr.id)).toBeInstanceOf(Date);

      const segunda = await validar(qr.texto);
      expect(segunda.status).toBe(200);
      expect(await segunda.json()).toMatchObject({ abrir: false, motivo_code: 'qr.usado' });
    });

    it('un QR ilegible o desconocido se rechaza con 200 y abrir:false, no con 503', async () => {
      await abrir();
      const ilegible = await validar('basura');
      expect(ilegible.status).toBe(200);
      expect(((await ilegible.json()) as Validacion).abrir).toBe(false);
    });

    it('una consulta lenta pero dentro del presupuesto igual abre', async () => {
      const p = await abrir();
      const qr = await crearQr(p.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
      retrasarConsumo(p, 300);
      const respuesta = await validar(qr.texto);
      expect(respuesta.status).toBe(200);
      expect(((await respuesta.json()) as Validacion).abrir).toBe(true);
    });

    it('con el presupuesto vencido responde 503 y no consume el QR (ROLLBACK, no COMMIT)', async () => {
      const p = await abrir({
        PETICION_MS_DISPOSITIVOS: '500',
        DB_ESPERA_MS_DISPOSITIVOS: '100',
        DB_CONSULTA_MS_DISPOSITIVOS: '300',
      });
      const qr = await crearQr(p.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
      retrasarConsumo(p, 700);

      const respuesta = await validar(qr.texto);
      expect(respuesta.status).toBe(503);
      expect(await respuesta.json()).toMatchObject({ code: 'servicio.no_disponible' });
      // Deja terminar la transacción abandonada: debe cerrar en ROLLBACK.
      await espera(900);
      expect(await usadoAt(p, qr.id)).toBeNull();
    });

    it('un cliente lento (cabeceras y cuerpo en tramos separados) igual obtiene su respuesta', async () => {
      const p = await abrir();
      const qr = await crearQr(p.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
      const cuerpo = JSON.stringify({ token: qr.texto, leido_en: new Date().toISOString() });

      const estado = await new Promise<{ status: number; cuerpo: string }>((resolver, rechazar) => {
        const peticion = httpRequest(
          `${url}/dispositivos/validaciones`,
          {
            method: 'POST',
            headers: {
              authorization: a.dispositivoPrincipal.encabezado,
              'content-type': 'application/json',
              'content-length': Buffer.byteLength(cuerpo),
            },
          },
          (res) => {
            let texto = '';
            res.on('data', (trozo: Buffer) => {
              texto += trozo.toString();
            });
            res.on('end', () => {
              resolver({ status: res.statusCode ?? 0, cuerpo: texto });
            });
          },
        );
        peticion.on('error', rechazar);
        peticion.write(cuerpo.slice(0, 10));
        setTimeout(() => {
          peticion.end(cuerpo.slice(10));
        }, 300);
      });
      expect(estado.status).toBe(200);
      expect(JSON.parse(estado.cuerpo)).toMatchObject({ abrir: true });
    });

    it('si el cliente se desconecta de verdad con la transacción abierta, no se hace COMMIT', async () => {
      const p = await abrir({ DB_CONSULTA_MS_DISPOSITIVOS: '1000' });
      const qr = await crearQr(p.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
      retrasarConsumo(p, 800);

      const cuerpo = JSON.stringify({ token: qr.texto, leido_en: new Date().toISOString() });
      const peticion = httpRequest(`${url}/dispositivos/validaciones`, {
        method: 'POST',
        headers: {
          authorization: a.dispositivoPrincipal.encabezado,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(cuerpo),
        },
      });
      peticion.on('error', () => undefined);
      peticion.end(cuerpo);
      await espera(300);
      peticion.destroy();

      // La placa ya no espera la respuesta: un COMMIT consumiría un QR sin abrir la puerta.
      await espera(1200);
      expect(await usadoAt(p, qr.id)).toBeNull();
      const [filas] = await p.pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS total FROM eventos_acceso WHERE resultado = 'permitido'",
      );
      expect(Number(filas[0]?.total)).toBe(0);
    });
  });

  describe('POST /sesiones y POST /qr-accesos', () => {
    it('inicia sesión con cuerpo y con esa sesión genera un QR', async () => {
      await abrir();
      const sesion = await fetch(`${url}/sesiones`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pin: a.usuario.pin }),
      });
      expect(sesion.status).toBe(200);
      const { acceso } = (await sesion.json()) as { acceso: string };

      const qr = await fetch(`${url}/qr-accesos`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${acceso}` },
        body: JSON.stringify({ puerta_ids: [a.puertaPrincipal.id] }),
      });
      expect(qr.status).toBe(201);
      expect(((await qr.json()) as { texto: string }).texto).toMatch(/^AQ1\./);
    });
  });

  describe('POST /dispositivos/confirmaciones', () => {
    // Usaba `request.signal`: con un cliente real llegaba abortada y respondía 503 (ver presupuesto.ts).
    it('con un cliente real responde 204 (y repetida, 204) y no 503', async () => {
      const p = await abrir();
      const qr = await crearQr(p.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
      const validada = (await (await validar(qr.texto)).json()) as Validacion & {
        evento_id: string;
      };
      expect(validada.abrir).toBe(true);

      for (let intento = 0; intento < 2; intento++) {
        const respuesta = await fetch(`${url}/dispositivos/confirmaciones`, {
          method: 'POST',
          headers: {
            authorization: a.dispositivoPrincipal.encabezado,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ evento_id: validada.evento_id, resultado: 'ejecutada' }),
        });
        expect(respuesta.status).toBe(204);
      }
      const [filas] = await p.pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) AS total FROM confirmaciones_apertura',
      );
      expect(Number(filas[0]?.total)).toBe(1);
    });
  });
});
