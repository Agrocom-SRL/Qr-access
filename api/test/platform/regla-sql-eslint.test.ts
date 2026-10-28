import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- el archivo de configuración es JS sin tipos; solo se lee la lista de reglas.
import { REGLAS_SQL } from '../../eslint.config.js';

/** La regla contra SQL con plantillas (ADR 0002, ADR 0033 §2) no debe poder evadirse. */
const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: (await import('typescript-eslint')).parser },
      rules: { 'no-restricted-syntax': ['error', ...(REGLAS_SQL as object[])] },
    },
  ],
});

async function marcas(codigo: string): Promise<number> {
  const [resultado] = await eslint.lintText(codigo, { filePath: 'src/x.ts' });
  return resultado?.messages.filter((m) => m.ruleId === 'no-restricted-syntax').length ?? 0;
}

describe('regla ESLint contra SQL interpolado', () => {
  it.each([
    ['variable con otro nombre', 'const texto = `SELECT * FROM t WHERE a = ${x}`;'],
    ['asignación posterior', 'let q; q = `select * from t where a = ${x}`;'],
    ['array con join', "const p = [`WHERE a = ${x}`, 'AND b = ?'].join(' ');"],
    ['concat', "const p = 'SELECT 1'.concat(`ORDER BY ${x}`);"],
    ['plantilla etiquetada', 'tag`SELECT * FROM t WHERE a = ${x}`;'],
    ['propiedad sql', 'const o = { sql: `${x} = ?` };'],
    ['propiedad sql con SQL', 'const o = { sql: `UPDATE t SET a = ${x}` };'],
    ['plantilla en objeto', 'const o = { donde: `AND a = ${x}` };'],
    ['mayúsculas y espacios', 'f(`  delete from t where id = ${x}`);'],
    ['asignación a propiedad sql', 'o.sql = `${x} = ?`;'],
    ['llamada a query', 'pool.query(`${x}`);'],
  ])('marca: %s', async (_nombre, codigo) => {
    expect(await marcas(codigo)).toBeGreaterThan(0);
  });

  it.each([
    ['SQL con placeholders', "pool.query('SELECT * FROM t WHERE a = ?', [x]);"],
    ['plantilla sin expresiones', 'const q = `SELECT * FROM t`;'],
    ['texto que no es SQL', 'const m = `Hola ${nombre}`;'],
    ['mensaje de error', 'throw new Error(`Falta ${campo}`);'],
    ['plantilla que contiene la palabra después', 'const m = `El ${x} FROM`;'],
  ])('no marca: %s', async (_nombre, codigo) => {
    expect(await marcas(codigo)).toBe(0);
  });
});
