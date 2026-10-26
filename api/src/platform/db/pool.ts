import mysql, { type Pool, type PoolConnection } from 'mysql2/promise';
import { PoolSaturado } from '../errores/servicio-no-disponible.js';

export interface OpcionesBase {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
}

/** Los topes de un pool (ADR 0030 §3.4, ADR 0032 §1). Sin ellos, el pool no tiene límites de espera. */
export interface TopesDePool {
  /** Conexiones simultáneas con la base. */
  readonly conexiones: number;
  /** `queueLimit`: peticiones que pueden esperar una conexión; más allá, falla rápido. */
  readonly cola: number;
  /** Cuánto espera una petición por una conexión antes de rendirse. */
  readonly esperaMs: number;
  /** Tiempo máximo de una consulta (`max_statement_time` de MariaDB). */
  readonly consultaMs: number;
}

const TOPES_POR_OMISION: TopesDePool = {
  conexiones: 10,
  cola: 0,
  esperaMs: 0,
  consultaMs: 0,
};

/**
 * Pool de mysql2 con las reglas de ADR 0002: placeholders `?` (sin nombrados ni varias
 * sentencias por llamada), fechas en UTC y BIGINT/DECIMAL como string. Con `topes`, además
 * falla rápido por saturación (cola llena o espera agotada → `PoolSaturado`) y limita la
 * duración de cada consulta.
 */
export function crearPool(opciones: OpcionesBase, topes: Partial<TopesDePool> = {}): Pool {
  const efectivos = { ...TOPES_POR_OMISION, ...topes };
  const pool = mysql.createPool({
    ...opciones,
    charset: 'utf8mb4_unicode_ci',
    timezone: 'Z',
    supportBigNumbers: true,
    bigNumberStrings: true,
    decimalNumbers: false,
    namedPlaceholders: false,
    multipleStatements: false,
    connectionLimit: efectivos.conexiones,
    queueLimit: efectivos.cola,
  });
  if (efectivos.consultaMs > 0) limitarConsultas(pool, efectivos.consultaMs);
  acotarEspera(pool, efectivos.esperaMs);
  return pool;
}

/**
 * `max_statement_time` en cada conexión nueva: la base corta toda sentencia que pase del
 * tope (MariaDB 10.11, ADR 0034). Se mide en segundos, con decimales.
 */
function limitarConsultas(pool: Pool, consultaMs: number): void {
  pool.pool.on('connection', (conexion) => {
    conexion.query('SET SESSION max_statement_time = ?', [consultaMs / 1000], () => undefined);
  });
}

/** mysql2 no pone `Error.code` al rechazo por `queueLimit`: se reconoce por su mensaje. */
const MENSAJE_COLA_LLENA = 'Queue limit reached.';

function esperarConexion(
  pendiente: Promise<PoolConnection>,
  esperaMs: number,
): Promise<PoolConnection> {
  return new Promise<PoolConnection>((resolver, rechazar) => {
    let vencida = false;
    const temporizador =
      esperaMs > 0
        ? setTimeout(() => {
            vencida = true;
            rechazar(new PoolSaturado('espera_agotada'));
          }, esperaMs)
        : null;
    pendiente.then(
      (conexion) => {
        if (temporizador !== null) clearTimeout(temporizador);
        // Llegó tarde: nadie la espera, vuelve al pool para el siguiente.
        if (vencida) conexion.release();
        else resolver(conexion);
      },
      (error: unknown) => {
        if (temporizador !== null) clearTimeout(temporizador);
        if (vencida) return;
        if (error instanceof Error && error.message === MENSAJE_COLA_LLENA) {
          rechazar(new PoolSaturado('cola_llena'));
        } else {
          rechazar(error instanceof Error ? error : new Error(String(error)));
        }
      },
    );
  });
}

type Sentencia = (...argumentos: unknown[]) => Promise<unknown>;

/**
 * mysql2 no tiene tiempo máximo de espera por conexión: se lo pone este envoltorio a
 * `getConnection`, `query` y `execute`. Una petición que espera más de `esperaMs` recibe
 * `PoolSaturado` (503) en vez de colgarse detrás de las demás. Una petición abandonada sigue
 * ocupando su lugar en la cola hasta que le toque, y entonces devuelve la conexión.
 */
function acotarEspera(pool: Pool, esperaMs: number): void {
  const original = pool.getConnection.bind(pool);
  const obtener = (): Promise<PoolConnection> => esperarConexion(original(), esperaMs);
  const conConexion =
    (nombre: 'query' | 'execute'): Sentencia =>
    async (...argumentos) => {
      const conexion = await obtener();
      try {
        return await (conexion[nombre] as Sentencia).apply(conexion, argumentos);
      } finally {
        conexion.release();
      }
    };
  pool.getConnection = obtener;
  pool.query = conConexion('query') as unknown as Pool['query'];
  pool.execute = conConexion('execute') as unknown as Pool['execute'];
}
