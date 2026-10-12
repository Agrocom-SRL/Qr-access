import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Archivos donde sí se permiten valores literales de color: los tokens. */
const TOKENS = ['theme/acceso-tokens.css', 'theme/theme.ts', 'theme/escalas.css'];

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

const raiz = join(import.meta.dirname, '..');
const fuentes = archivos(raiz).filter(
  (f) => /\.(css|tsx?)$/.test(f) && !/\.test\.tsx?$/.test(f) && !TOKENS.some((t) => f.endsWith(t)),
);

describe('arquitectura (ADR 0012 y 0021)', () => {
  it('ningún color literal fuera de los tokens', () => {
    const infractores = fuentes.filter((f) =>
      /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(readFileSync(f, 'utf8')),
    );
    expect(infractores.map((f) => relative(raiz, f))).toEqual([]);
  });

  it('ninguna dimensión en px fuera de los tokens (salvo bordes de 1 y 2 px)', () => {
    const infractores = fuentes
      .filter((f) => f.endsWith('.css') && !f.includes('escalas.css'))
      .filter((f) =>
        /(?<![\d.])(?!0?\.?[12]px\b)\d+(\.\d+)?px/.test(
          readFileSync(f, 'utf8').replaceAll(/@media[^{]*/g, ''),
        ),
      );
    expect(infractores.map((f) => relative(raiz, f))).toEqual([]);
  });

  it('ningún texto de interfaz fuera de l10n', () => {
    const infractores = fuentes
      .filter((f) => f.endsWith('.tsx') && !f.includes('l10n'))
      .filter((f) =>
        />\s*[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(\s+[\wáéíóúñ]+)*\s*</.test(readFileSync(f, 'utf8')),
      );
    expect(infractores.map((f) => relative(raiz, f))).toEqual([]);
  });
});
