import { describe, expect, it } from 'vitest';
import { CacheCorta, vaciarCachesCortas } from '../../src/platform/cache/cache-corta.js';

describe('CacheCorta: vigencia por tiempo con reloj inyectado', () => {
  it('reutiliza el valor dentro de la vigencia y lo recalcula al vencer', async () => {
    const cache = new CacheCorta<number>(30_000);
    let llamadas = 0;
    const calcular = () => Promise.resolve(++llamadas);

    expect(await cache.obtener('k', 1_000, calcular)).toBe(1);
    expect(await cache.obtener('k', 30_999, calcular)).toBe(1);
    expect(llamadas).toBe(1);
    // A los 30 s justos de haberse calculado ya venció.
    expect(await cache.obtener('k', 31_000, calcular)).toBe(2);
    expect(llamadas).toBe(2);
  });

  it('separa las claves y no guarda las entradas vencidas', async () => {
    const cache = new CacheCorta<string>(10_000);
    await cache.obtener('a', 0, () => Promise.resolve('A'));
    await cache.obtener('b', 1, () => Promise.resolve('B'));
    expect(cache.tamano).toBe(2);
    await cache.obtener('c', 20_000, () => Promise.resolve('C'));
    expect(cache.tamano).toBe(1);
  });

  it('un reloj que retrocede no sirve un valor del futuro', async () => {
    const cache = new CacheCorta<number>(10_000);
    let n = 0;
    await cache.obtener('k', 100_000, () => Promise.resolve(++n));
    expect(await cache.obtener('k', 50_000, () => Promise.resolve(++n))).toBe(2);
  });

  it('comparte la carga en curso y no guarda los errores', async () => {
    const cache = new CacheCorta<number>(10_000);
    let llamadas = 0;
    const lenta = async () => {
      llamadas++;
      await new Promise((r) => setTimeout(r, 20));
      return 7;
    };
    const [x, y] = await Promise.all([cache.obtener('k', 0, lenta), cache.obtener('k', 0, lenta)]);
    expect([x, y, llamadas]).toEqual([7, 7, 1]);

    await expect(
      cache.obtener('falla', 0, () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');
    expect(await cache.obtener('falla', 1, () => Promise.resolve(1))).toBe(1);
  });

  it('vaciarCachesCortas las vacía todas', async () => {
    const cache = new CacheCorta<number>(10_000);
    let n = 0;
    await cache.obtener('k', 0, () => Promise.resolve(++n));
    vaciarCachesCortas();
    expect(await cache.obtener('k', 1, () => Promise.resolve(++n))).toBe(2);
  });
});
