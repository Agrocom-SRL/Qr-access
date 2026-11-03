import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { RowDataPacket } from 'mysql2/promise';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { crearEscenario, marcarEnLinea, type Escenario } from '../helpers/fixtures.js';
import { iniciarSesion, type Sesion } from '../helpers/http.js';

/**
 * Tests con un servidor REAL (`app.listen` + `fetch`) para `POST /puertas/{id}/abrir`, como exige el ADR 0032: con
 * `app.inject()` no se abre un socket y no se ve el defecto de `request.signal` (Node 22 lo aborta al terminar de
 * leer el cuerpo de un POST). La ruta usa `presupuestoDePeticion`, nunca `request.signal`.
 */
const espera = (ms: number): Promise<void> => new Promise((resolver) => setTimeout(resolver, ms));

describe('apertura manual con un servidor HTTP real (ADR 0032, ADR 0035)', () => {
  let prueba: AppDePrueba | undefined;
  let url = '';
  let a: Escenario;
  let sesion: Sesion;

  async function levantar(entorno: Record<string, string> = {}): Promise<AppDePrueba> {
    const p = await crearAppDePrueba(undefined, entorno);
    prueba = p;
    await reiniciarBase(p.pool);
    a = await crearEscenario(p.pool, 'AAA');
    await marcarEnLinea(p.pool, a.dispositivoPrincipal.id);
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

  const abrir = (puertaId: string, clave: string = randomUUID()): Promise<Response> =>
    fetch(`${url}/puertas/${puertaId}/abrir`, {
      method: 'POST',
      headers: { authorization: `Bearer ${sesion.acceso}`, 'idempotency-key': clave },
    });

  const contar = async (
    p: AppDePrueba,
    tabla: 'lecturas' | 'ordenes_apertura',
  ): Promise<number> => {
    const [filas] = await p.pool.query<RowDataPacket[]>(
      tabla === 'lecturas'
        ? "SELECT COUNT(*) AS n FROM lecturas WHERE metodo = 'manual'"
        : 'SELECT COUNT(*) AS n FROM ordenes_apertura',
    );
    return Number(filas[0]?.n);
  };

  it('con un cliente real y sin cuerpo: 202 con la orden, la consulta y el reintento idempotente', async () => {
    const p = await levantar();

    const primera = await abrir(a.puertaPrincipal.id, 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d');
    expect(primera.status).toBe(202);
    expect(primera.headers.get('cache-control')).toContain('no-store');
    const orden = (await primera.json()) as { orden_id: string; estado: string; vence_at: string };
    expect(orden).toMatchObject({ estado: 'pendiente' });

    const repetida = await abrir(a.puertaPrincipal.id, 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d');
    expect(repetida.status).toBe(202);
    expect(repetida.headers.get('idempotent-replayed')).toBe('true');
    expect(((await repetida.json()) as { orden_id: string }).orden_id).toBe(orden.orden_id);

    const estado = await fetch(`${url}/ordenes-apertura/${orden.orden_id}`, {
      headers: { authorization: `Bearer ${sesion.acceso}` },
    });
    expect(estado.status).toBe(200);
    expect(await estado.json()).toMatchObject({
      orden_id: orden.orden_id,
      estado: 'pendiente',
      resultado: null,
    });

    expect(await contar(p, 'lecturas')).toBe(1);
    expect(await contar(p, 'ordenes_apertura')).toBe(1);
  });

  it('un rechazo de negocio sale como problema (409) y deja su lectura, también con cliente real', async () => {
    const p = await levantar();
    await p.pool.query('UPDATE puertas SET apertura_manual = 0');
    const respuesta = await abrir(a.puertaPrincipal.id);
    expect(respuesta.status).toBe(409);
    expect(respuesta.headers.get('content-type')).toContain('application/problem+json');
    expect(await respuesta.json()).toMatchObject({ code: 'manual.no_habilitada', status: 409 });
    expect(await contar(p, 'lecturas')).toBe(1);
    expect(await contar(p, 'ordenes_apertura')).toBe(0);
  });

  it('una puerta que no es de la cuenta es 404 con cliente real', async () => {
    await levantar();
    const respuesta = await abrir('999999');
    expect(respuesta.status).toBe(404);
  });

  it('sin la Idempotency-Key es 400 con cliente real', async () => {
    const p = await levantar();
    const respuesta = await fetch(`${url}/puertas/${a.puertaPrincipal.id}/abrir`, {
      method: 'POST',
      headers: { authorization: `Bearer ${sesion.acceso}` },
    });
    expect(respuesta.status).toBe(400);
    expect(await contar(p, 'lecturas')).toBe(0);
  });

  it('con el presupuesto de la petición vencido responde 503 y NO deja orden ni lectura (ROLLBACK, no COMMIT)', async () => {
    const p = await levantar({
      PETICION_MS_APP: '500',
      DB_ESPERA_MS_APP: '100',
      DB_CONSULTA_MS_APP: '300',
    });
    // La base «tarda» justo antes de insertar la orden, con la transacción ya abierta.
    const original = p.pool.getConnection.bind(p.pool);
    p.pool.getConnection = async () => {
      const conexion = await original();
      const query = conexion.query.bind(conexion) as (...a: unknown[]) => Promise<unknown>;
      conexion.query = (async (sql: unknown, ...resto: unknown[]) => {
        if (typeof sql === 'string' && sql.startsWith('INSERT INTO ordenes_apertura'))
          await espera(700);
        return query(sql, ...resto);
      }) as typeof conexion.query;
      return conexion;
    };

    const respuesta = await abrir(a.puertaPrincipal.id);
    expect(respuesta.status).toBe(503);
    expect(await respuesta.json()).toMatchObject({ code: 'servicio.no_disponible' });
    // Deja terminar la transacción abandonada: debe cerrar en ROLLBACK.
    await espera(900);
    expect(await contar(p, 'ordenes_apertura')).toBe(0);
    expect(await contar(p, 'lecturas')).toBe(0);
  });
});
