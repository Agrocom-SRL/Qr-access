import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import mysql from 'mysql2/promise';

/**
 * Antes de correr nada, comprueba que la base de tests tiene todas las migraciones de
 * `db/migrations`. Falla con el comando que hay que correr: así un esquema atrasado no se
 * disfraza de error de SQL a mitad de un test. La guarda de `_testing` va primero.
 */
export default async function verificarEsquema(): Promise<void> {
  const base = process.env.DB_DATABASE_TEST ?? 'qr_access_testing';
  if (!/_testing(_\d+)?$/.test(base)) {
    throw new Error(`La base de tests tiene que terminar en _testing (recibí "${base}")`);
  }

  const carpeta = resolve(import.meta.dirname, '../../db/migrations');
  const esperadas = readdirSync(carpeta)
    .filter((archivo) => archivo.endsWith('.sql'))
    .map((archivo) => archivo.split('_')[0]);

  const conexion = await mysql.createConnection({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3307),
    user: process.env.DB_USERNAME ?? 'qr_access',
    password: process.env.DB_PASSWORD ?? 'qr_access',
    database: base,
  });
  try {
    const [filas] = await conexion
      .query<mysql.RowDataPacket[]>('SELECT version FROM schema_migrations')
      .catch(() => [[]] as [mysql.RowDataPacket[]]);
    const aplicadas = new Set(filas.map((fila) => String(fila.version)));
    const faltan = esperadas.filter((version) => version !== undefined && !aplicadas.has(version));
    if (faltan.length > 0) {
      throw new Error(
        `A la base ${base} le faltan ${faltan.length} migraciones. Corre (bin/verify api lo hace solo):\n` +
          `  docker compose --profile herramientas run --rm -e DATABASE_URL=mysql://qr_access:qr_access@db:3306/${base} dbmate --no-dump-schema up`,
      );
    }
  } finally {
    await conexion.end();
  }
}
