import type { Pool, RowDataPacket } from 'mysql2/promise';
import { afterEach, describe, expect, it } from 'vitest';
import { ejecutar as validarQr } from '../../src/modules/accesos/actions/validar-qr.js';
import { cargarConfig } from '../../src/config.js';
import { ContextoCuenta } from '../../src/platform/contexto/contexto-cuenta.js';
import { crearPool } from '../../src/platform/db/pool.js';
import { enTransaccionIdempotente } from '../../src/platform/db/transaccion.js';
import { PoolSaturado } from '../../src/platform/errores/servicio-no-disponible.js';
import type { PrincipalDispositivo } from '../../src/platform/seguridad/principal.js';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { crearEscenario, crearQr, type Escenario } from '../helpers/fixtures.js';

const espera = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

function errorDeBloqueo(): Error {
  return Object.assign(new Error('Deadlock found'), { code: 'ER_LOCK_DEADLOCK', errno: 1213 });
}

describe('pool acotado (ADR 0032 §1)', () => {
  const pools: Pool[] = [];
  afterEach(async () => {
    await Promise.all(pools.splice(0).map((pool) => pool.end()));
  });

  function nuevo(topes: Parameters<typeof crearPool>[1]): Pool {
    const config = cargarConfig();
    const pool = crearPool(
      {
        host: config.DB_HOST,
        port: config.DB_PORT,
        database: config.DB_DATABASE,
        user: config.DB_USERNAME,
        password: config.DB_PASSWORD,
      },
      topes,
    );
    pools.push(pool);
    return pool;
  }

  it('una petición que espera más que el tope recibe PoolSaturado y el pool se recupera', async () => {
    const pool = nuevo({ conexiones: 1, cola: 5, esperaMs: 80 });
    const retenida = await pool.getConnection();

    const inicio = Date.now();
    await expect(pool.query('SELECT 1')).rejects.toMatchObject({
      name: 'PoolSaturado',
      motivo: 'espera_agotada',
    });
    expect(Date.now() - inicio).toBeLessThan(1000);

    // La petición abandonada devuelve su conexión cuando le toca: el pool sigue sirviendo.
    retenida.release();
    const [filas] = await pool.query<RowDataPacket[]>('SELECT 1 AS uno');
    expect(filas[0]?.uno).toBe(1);
  });

  it('con la cola llena falla de inmediato, sin esperar', async () => {
    const pool = nuevo({ conexiones: 1, cola: 1, esperaMs: 2000 });
    const retenida = await pool.getConnection();
    const enCola = pool.query('SELECT 1');

    const inicio = Date.now();
    const rechazo = pool.query('SELECT 2');
    await expect(rechazo).rejects.toBeInstanceOf(PoolSaturado);
    await expect(rechazo).rejects.toMatchObject({ motivo: 'cola_llena' });
    expect(Date.now() - inicio).toBeLessThan(500);

    retenida.release();
    await expect(enCola).resolves.toBeDefined();
  });

  it('corta toda consulta que pasa el tiempo máximo (max_statement_time)', async () => {
    const pool = nuevo({ conexiones: 1, consultaMs: 200 });
    const [limite] = await pool.query<RowDataPacket[]>('SELECT @@max_statement_time AS limite');
    expect(Number(limite[0]?.limite)).toBeCloseTo(0.2, 3);

    await expect(pool.query('SELECT SLEEP(2)')).rejects.toMatchObject({ errno: 1969 });
    // La conexión no queda inservible.
    const [filas] = await pool.query<RowDataPacket[]>('SELECT 1 AS uno');
    expect(filas[0]?.uno).toBe(1);
  });
});

describe('reintento único ante deadlock (ADR 0032 §2)', () => {
  it('repite la transacción una vez y devuelve el resultado', async () => {
    const config = cargarConfig();
    const pool = crearPool({
      host: config.DB_HOST,
      port: config.DB_PORT,
      database: config.DB_DATABASE,
      user: config.DB_USERNAME,
      password: config.DB_PASSWORD,
    });
    try {
      let intentos = 0;
      const resultado = await enTransaccionIdempotente(pool, () => {
        intentos += 1;
        return intentos === 1 ? Promise.reject(errorDeBloqueo()) : Promise.resolve('listo');
      });
      expect(resultado).toBe('listo');
      expect(intentos).toBe(2);

      intentos = 0;
      await expect(
        enTransaccionIdempotente(pool, () => {
          intentos += 1;
          return Promise.reject(errorDeBloqueo());
        }),
      ).rejects.toMatchObject({ code: 'ER_LOCK_DEADLOCK' });
      expect(intentos).toBe(2);

      // Un error que no es de bloqueo no se reintenta.
      intentos = 0;
      await expect(
        enTransaccionIdempotente(pool, () => {
          intentos += 1;
          return Promise.reject(new Error('otro'));
        }),
      ).rejects.toThrow('otro');
      expect(intentos).toBe(1);
    } finally {
      await pool.end();
    }
  });
});

/** Un pool que falla con un deadlock las primeras `veces` sentencias que empiecen con `prefijo`. */
function conDeadlocks(pool: Pool, prefijo: string, veces: number): Pool {
  let pendientes = veces;
  return new Proxy(pool, {
    get(objetivo, propiedad) {
      if (propiedad === 'getConnection') {
        return async () => {
          const conexion = await objetivo.getConnection();
          const original = conexion.query.bind(conexion) as (...a: unknown[]) => Promise<unknown>;
          conexion.query = ((sql: unknown, ...resto: unknown[]) => {
            if (typeof sql === 'string' && sql.startsWith(prefijo) && pendientes > 0) {
              pendientes -= 1;
              return Promise.reject(errorDeBloqueo());
            }
            return original(sql, ...resto);
          }) as typeof conexion.query;
          return conexion;
        };
      }
      const valor: unknown = Reflect.get(objetivo, propiedad);
      return typeof valor === 'function' ? (valor as () => unknown).bind(objetivo) : valor;
    },
  });
}

describe('la API ante la saturación', () => {
  let prueba: AppDePrueba | null = null;
  let a: Escenario;

  async function abrir(entorno: Record<string, string>): Promise<AppDePrueba> {
    prueba = await crearAppDePrueba(undefined, entorno);
    await reiniciarBase(prueba.pool);
    a = await crearEscenario(prueba.pool, 'AAA');
    return prueba;
  }
  afterEach(async () => {
    await prueba?.cerrar();
    prueba = null;
  });

  /** Una ruta pública que solo usa el pool de la app (`/salud` traduce su propio error). */
  const sondear = (p: AppDePrueba) => p.app.inject({ method: 'GET', url: '/api/v1/prueba/sondeo' });
  const registrarSondeo = (p: AppDePrueba) =>
    p.app.get(
      '/api/v1/prueba/sondeo',
      { config: { acceso: 'publica', limite: 'ninguno' } },
      async () => {
        await p.pool.query('SELECT 1');
        return { ok: true };
      },
    );
  const validar = (p: AppDePrueba, token: string) =>
    p.app.inject({
      method: 'POST',
      url: '/api/v1/dispositivos/validaciones',
      headers: { authorization: a.dispositivoPrincipal.encabezado },
      payload: { token },
    });
  const usadoAt = async (p: AppDePrueba, qrId: string): Promise<unknown> => {
    const [filas] = await p.pool.query<RowDataPacket[]>(
      'SELECT usado_at FROM qr_accesos WHERE id = ?',
      [qrId],
    );
    return filas[0]?.usado_at;
  };

  it('pool de la app agotado: 503 servicio.no_disponible con Retry-After configurable', async () => {
    const p = await abrir({
      DB_POOL_APP: '1',
      DB_ESPERA_MS_APP: '100',
      REINTENTO_503_SEGUNDOS: '7',
    });
    registrarSondeo(p);
    const retenida = await p.pool.getConnection();
    try {
      const respuesta = await sondear(p);
      expect(respuesta.statusCode).toBe(503);
      expect(respuesta.json()).toMatchObject({
        code: 'servicio.no_disponible',
        status: 503,
        reintentar_en_segundos: 7,
      });
      expect(respuesta.headers['retry-after']).toBe('7');
      expect(respuesta.headers['content-type']).toContain('application/problem+json');
      expect(respuesta.headers['cache-control']).toBe('no-store');
    } finally {
      retenida.release();
    }
    expect((await sondear(p)).statusCode).toBe(200);
  });

  it('cola de la app llena: la petición de más recibe 503 sin acumularse', async () => {
    const p = await abrir({ DB_POOL_APP: '1', DB_COLA_APP: '1', DB_ESPERA_MS_APP: '300' });
    registrarSondeo(p);
    const retenida = await p.pool.getConnection();
    try {
      const inicio = Date.now();
      const respuestas = await Promise.all([sondear(p), sondear(p), sondear(p)]);
      expect(respuestas.map((r) => r.statusCode)).toEqual([503, 503, 503]);
      for (const r of respuestas) {
        expect(r.json()).toMatchObject({ code: 'servicio.no_disponible' });
        expect(r.headers['retry-after']).toBe('2');
      }
      expect(Date.now() - inicio).toBeLessThan(2000);
    } finally {
      retenida.release();
    }
  });

  it('con el pool de la app saturado, la puerta sigue validando por su pool reservado', async () => {
    const p = await abrir({ DB_POOL_APP: '1', DB_ESPERA_MS_APP: '100' });
    registrarSondeo(p);
    const retenida = await p.pool.getConnection();
    try {
      expect((await sondear(p)).statusCode).toBe(503);
      const qr = await crearQr(p.poolDispositivos, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
      const respuesta = await validar(p, qr.texto);
      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.json()).toMatchObject({ abrir: true });
    } finally {
      retenida.release();
    }
  });

  it('con el pool del dispositivo saturado responde 503 y la puerta no abre; al liberarse, abre', async () => {
    const p = await abrir({
      DB_POOL_DISPOSITIVOS: '1',
      DB_COLA_DISPOSITIVOS: '1',
      DB_ESPERA_MS_DISPOSITIVOS: '150',
    });
    const qr = await crearQr(p.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
    const retenida = await p.poolDispositivos.getConnection();
    try {
      const respuesta = await validar(p, qr.texto);
      expect(respuesta.statusCode).toBe(503);
      expect(respuesta.json()).toMatchObject({ code: 'servicio.no_disponible' });
      expect(respuesta.json()).not.toHaveProperty('abrir');
      expect(Number(respuesta.headers['retry-after'])).toBeGreaterThanOrEqual(1);
      // Falla segura: nada se consumió.
      expect(await usadoAt(p, qr.id)).toBeNull();
    } finally {
      retenida.release();
    }
    const reintento = await validar(p, qr.texto);
    expect(reintento.statusCode).toBe(200);
    expect(reintento.json()).toMatchObject({ abrir: true });
  });

  it('una petición que pasa el tiempo máximo responde 503 (global y por ruta)', async () => {
    const p = await abrir({ PETICION_MS_APP: '100' });
    p.app.get(
      '/api/v1/prueba/lenta',
      { config: { acceso: 'publica', limite: 'ninguno' } },
      async () => {
        await espera(600);
        return { ok: true };
      },
    );
    p.app.get(
      '/api/v1/prueba/lenta-con-tope-propio',
      { config: { acceso: 'publica', limite: 'ninguno' }, handlerTimeout: 5000 },
      async () => {
        await espera(250);
        return { ok: true };
      },
    );
    const lenta = await p.app.inject({ method: 'GET', url: '/api/v1/prueba/lenta' });
    expect(lenta.statusCode).toBe(503);
    expect(lenta.json()).toMatchObject({ code: 'servicio.no_disponible' });
    expect(lenta.headers['retry-after']).toBe('2');
    const conTopePropio = await p.app.inject({
      method: 'GET',
      url: '/api/v1/prueba/lenta-con-tope-propio',
    });
    expect(conTopePropio.statusCode).toBe(200);
  });

  it('una consulta que pasa el tiempo máximo de la base sale como 503, sin SQL en la respuesta', async () => {
    const p = await abrir({ DB_CONSULTA_MS_APP: '150' });
    p.app.get(
      '/api/v1/prueba/consulta-lenta',
      { config: { acceso: 'publica', limite: 'ninguno' } },
      async () => {
        await p.pool.query('SELECT SLEEP(2)');
        return { ok: true };
      },
    );
    const respuesta = await p.app.inject({ method: 'GET', url: '/api/v1/prueba/consulta-lenta' });
    expect(respuesta.statusCode).toBe(503);
    expect(respuesta.json()).toMatchObject({ code: 'servicio.no_disponible' });
    expect(respuesta.body).not.toContain('SLEEP');
  });

  it('un ErrorDeDominio 429 o 503 con reintentar_en_segundos también lleva Retry-After', async () => {
    const p = await abrir({});
    const { ErrorDeDominio } = await import('../../src/platform/errores/error-de-dominio.js');
    p.app.get(
      '/api/v1/prueba/bloqueo',
      { config: { acceso: 'publica', limite: 'ninguno' } },
      () => {
        throw new ErrorDeDominio('sesion.bloqueada', 429, { reintentar_en_segundos: 7 });
      },
    );
    const respuesta = await p.app.inject({ method: 'GET', url: '/api/v1/prueba/bloqueo' });
    expect(respuesta.statusCode).toBe(429);
    expect(respuesta.headers['retry-after']).toBe('7');
  });

  describe('validar-qr ante un deadlock', () => {
    const dispositivo = (): PrincipalDispositivo => ({
      tipo: 'dispositivo',
      dispositivoId: a.dispositivoPrincipal.id,
      cuentaId: a.cuenta.id,
      puertaId: a.puertaPrincipal.id,
    });
    const validarConPool = (pool: Pool, texto: string) =>
      ContextoCuenta.ejecutar(
        {
          cuentaId: a.cuenta.id,
          usuarioId: null,
          rolActivoId: null,
          dispositivoId: a.dispositivoPrincipal.id,
          origen: 'dispositivo',
        },
        () => validarQr(pool, dispositivo(), { texto, leidoEn: null }),
      );
    const contarEventos = async (p: AppDePrueba): Promise<number> => {
      const [filas] = await p.pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) AS total FROM eventos_acceso',
      );
      return Number(filas[0]?.total);
    };

    it('un deadlock al consumir se reintenta una vez: abre, consume una sola vez y deja un solo evento', async () => {
      const p = await abrir({});
      const qr = await crearQr(p.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
      const resultado = await validarConPool(
        conDeadlocks(p.poolDispositivos, 'UPDATE qr_accesos', 1),
        qr.texto,
      );
      expect(resultado).toMatchObject({ abrir: true });
      expect(await usadoAt(p, qr.id)).not.toBeNull();
      expect(await contarEventos(p)).toBe(1);
    });

    it('si el deadlock se repite, no abre ni consume ni registra un permitido (falla segura)', async () => {
      const p = await abrir({});
      const qr = await crearQr(p.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
      await expect(
        validarConPool(conDeadlocks(p.poolDispositivos, 'UPDATE qr_accesos', 2), qr.texto),
      ).rejects.toMatchObject({ code: 'ER_LOCK_DEADLOCK' });
      expect(await usadoAt(p, qr.id)).toBeNull();
      expect(await contarEventos(p)).toBe(0);
    });

    it('un deadlock al registrar un rechazo también se reintenta una vez', async () => {
      const p = await abrir({});
      const resultado = await validarConPool(
        conDeadlocks(p.poolDispositivos, 'INSERT INTO eventos_acceso', 1),
        'texto-que-no-es-un-qr',
      );
      expect(resultado).toMatchObject({ abrir: false, motivo_code: 'qr.formato_invalido' });
      expect(await contarEventos(p)).toBe(1);
    });
  });
});
