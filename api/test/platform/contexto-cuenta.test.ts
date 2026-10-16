import { describe, expect, it } from 'vitest';
import {
  ContextoCuenta,
  SinContextoDeCuenta,
  type DatosContexto,
} from '../../src/platform/contexto/contexto-cuenta.js';

const deCuenta: DatosContexto = {
  cuentaId: '7',
  usuarioId: '70',
  rolActivoId: '3',
  dispositivoId: null,
  origen: 'api',
};

describe('ContextoCuenta (falla cerrado)', () => {
  it('sin contexto, pedir la cuenta lanza SinContextoDeCuenta', () => {
    expect(() => ContextoCuenta.cuentaRequerida()).toThrow(SinContextoDeCuenta);
    expect(ContextoCuenta.actual()).toBeUndefined();
  });

  it('en contexto de plataforma (cuenta null), pedir la cuenta también falla', () => {
    ContextoCuenta.ejecutar({ ...deCuenta, cuentaId: null }, () => {
      expect(() => ContextoCuenta.cuentaRequerida()).toThrow(SinContextoDeCuenta);
    });
  });

  it('el contexto sobrevive a la asincronía y no se filtra fuera de ejecutar', async () => {
    await ContextoCuenta.ejecutar(deCuenta, async () => {
      await new Promise((resolver) => setTimeout(resolver, 1));
      expect(ContextoCuenta.cuentaRequerida()).toBe('7');
    });
    expect(ContextoCuenta.actual()).toBeUndefined();
  });

  it('dos contextos concurrentes no se mezclan', async () => {
    const leer = (cuentaId: string) =>
      ContextoCuenta.ejecutar({ ...deCuenta, cuentaId }, async () => {
        await new Promise((resolver) => setTimeout(resolver, 1));
        return ContextoCuenta.cuentaRequerida();
      });
    await expect(Promise.all([leer('1'), leer('2')])).resolves.toEqual(['1', '2']);
  });

  it('el contexto no se puede modificar', () => {
    ContextoCuenta.ejecutar(deCuenta, () => {
      expect(Object.isFrozen(ContextoCuenta.requerido())).toBe(true);
    });
  });

  it('ejecutarEn abre un contexto de sistema sobre una cuenta', () => {
    ContextoCuenta.ejecutarEn('9', () => {
      expect(ContextoCuenta.requerido()).toMatchObject({ cuentaId: '9', origen: 'sistema' });
    });
  });
});
