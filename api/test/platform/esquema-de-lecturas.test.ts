import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';

/**
 * La migración `rename_eventos_acceso_a_lecturas` deja el esquema íntegro: la tabla vieja ya no existe, las tablas
 * hijas y la autorreferencia apuntan a `lecturas` y ningún índice ni clave foránea conserva el nombre anterior
 * (salvo los CHECK, que se dejan a propósito para no copiar la tabla; ver la migración).
 */
describe('esquema de lecturas', () => {
  let prueba: AppDePrueba;
  beforeAll(async () => {
    prueba = await crearAppDePrueba();
  });
  afterAll(async () => {
    await prueba.cerrar();
  });

  async function filas(sql: string): Promise<RowDataPacket[]> {
    const [resultado] = await prueba.pool.query<RowDataPacket[]>(sql);
    return resultado;
  }

  it('existe `lecturas` y ya no existe `eventos_acceso`', async () => {
    const tablas = await filas(
      `SELECT table_name AS nombre FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name IN ('lecturas', 'eventos_acceso')`,
    );
    expect(tablas.map((t) => String(t.nombre))).toEqual(['lecturas']);
  });

  it('las claves foráneas hacia la tabla (hijas y autorreferencia) apuntan a `lecturas`', async () => {
    const claves = await filas(
      `SELECT table_name AS tabla, constraint_name AS clave FROM information_schema.referential_constraints
        WHERE constraint_schema = DATABASE() AND referenced_table_name = 'lecturas' ORDER BY table_name`,
    );
    expect(claves.map((c) => `${c.tabla}.${c.clave}`)).toEqual([
      'confirmaciones_apertura.fk_confirmaciones_apertura_evento',
      'lecturas.fk_lecturas_repetido_de',
    ]);
  });

  it('los índices y las claves de la tabla ya no llevan el nombre anterior', async () => {
    const nombres = await filas(
      `SELECT DISTINCT index_name AS nombre FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = 'lecturas'
       UNION
       SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_schema = DATABASE() AND table_name = 'lecturas' AND constraint_type <> 'CHECK'`,
    );
    expect(nombres.filter((n) => String(n.nombre).includes('eventos_acceso'))).toEqual([]);
  });
});
