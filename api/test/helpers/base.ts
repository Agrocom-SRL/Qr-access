import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Pool, RowDataPacket } from 'mysql2/promise';

/** Las tablas que dbmate maneja y que nunca se vacían. */
const TABLAS_INTOCABLES = new Set(['schema_migrations']);

async function exigirBaseDeTests(pool: Pool): Promise<void> {
  const [filas] = await pool.query<RowDataPacket[]>('SELECT DATABASE() AS base');
  const base = String(filas[0]?.base);
  if (!/_testing(_\d+)?$/.test(base)) {
    throw new Error(`Me niego a vaciar "${base}": una base de tests termina en _testing`);
  }
}

/**
 * Sentencias de un seed: una por `;` al final de línea, sin los comentarios `--`. Los seeds
 * del catálogo están escritos para poder leerse así.
 */
export function sentenciasDe(sql: string): string[] {
  const sinComentarios = sql
    .split('\n')
    .filter((linea) => !linea.trimStart().startsWith('--'))
    .join('\n');
  return sinComentarios
    .split(/;\s*(?:\n|$)/)
    .map((sentencia) => sentencia.trim())
    .filter((sentencia) => sentencia !== '');
}

/** Carga `db/seeds/01_catalogo.sql`: la MISMA fuente de permisos que usa producción. */
export async function cargarCatalogo(pool: Pool): Promise<void> {
  const ruta = resolve(import.meta.dirname, '../../../db/seeds/01_catalogo.sql');
  for (const sentencia of sentenciasDe(readFileSync(ruta, 'utf8'))) {
    await pool.query(sentencia);
  }
}

/** Deja la base de tests sin datos (y con el catálogo de permisos). Solo corre sobre `*_testing`. */
export async function reiniciarBase(pool: Pool): Promise<void> {
  await exigirBaseDeTests(pool);
  const conexion = await pool.getConnection();
  try {
    const [tablas] = await conexion.query<RowDataPacket[]>(
      "SELECT table_name AS nombre FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'",
    );
    await conexion.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const tabla of tablas) {
      const nombre = String(tabla.nombre);
      if (!TABLAS_INTOCABLES.has(nombre) && /^[a-z_]+$/.test(nombre)) {
        await conexion.query(['TRUNCATE TABLE', nombre].join(' '));
      }
    }
    await conexion.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conexion.release();
  }
  await cargarCatalogo(pool);
}
