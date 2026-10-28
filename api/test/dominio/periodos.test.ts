import { describe, expect, it } from 'vitest';
import {
  diaLocal,
  inicioDelDiaLocal,
  inicioDelMesLocal,
  ZONA_DE_LOS_TOPES,
} from '../../src/modules/accesos/domain/vencimiento.js';
import {
  CLAVES,
  CLAVES_DE_LIMITE,
  definicionDe,
  valorEfectivo,
  valorValido,
} from '../../src/modules/limites/domain/claves.js';

describe('periodos de los topes de generación (ADR 0030 §2)', () => {
  it('los topes se cuentan en la zona de la plataforma (La Paz)', () => {
    expect(ZONA_DE_LOS_TOPES).toBe('America/La_Paz');
  });

  it('el día empieza a las 04:00 UTC (medianoche de La Paz) y el instante exacto ya es del día nuevo', () => {
    expect(
      inicioDelDiaLocal(new Date('2026-10-09T15:30:00Z'), 'America/La_Paz').toISOString(),
    ).toBe('2026-10-09T04:00:00.000Z');
    expect(
      inicioDelDiaLocal(new Date('2026-10-09T04:00:00Z'), 'America/La_Paz').toISOString(),
    ).toBe('2026-10-09T04:00:00.000Z');
    // 03:59 UTC todavía es el día anterior en La Paz
    expect(
      inicioDelDiaLocal(new Date('2026-10-09T03:59:59Z'), 'America/La_Paz').toISOString(),
    ).toBe('2026-10-08T04:00:00.000Z');
  });

  it('en el día que cambia la hora (25 h) el inicio sigue siendo la medianoche local', () => {
    // Nueva York, 1 de noviembre de 2026: termina el horario de verano. 23:50 local = 04:50Z del 2.
    expect(
      inicioDelDiaLocal(new Date('2026-11-02T04:50:00Z'), 'America/New_York').toISOString(),
    ).toBe('2026-11-01T04:00:00.000Z');
    expect(
      inicioDelDiaLocal(new Date('2026-11-02T05:30:00Z'), 'America/New_York').toISOString(),
    ).toBe('2026-11-02T05:00:00.000Z');
  });

  it('el mes empieza el día 1 a la medianoche local', () => {
    expect(
      inicioDelMesLocal(new Date('2026-10-31T23:00:00Z'), 'America/La_Paz').toISOString(),
    ).toBe('2026-10-01T04:00:00.000Z');
    // 01:00 UTC del 1 de noviembre todavía es octubre en La Paz
    expect(
      inicioDelMesLocal(new Date('2026-11-01T01:00:00Z'), 'America/La_Paz').toISOString(),
    ).toBe('2026-10-01T04:00:00.000Z');
    expect(
      inicioDelMesLocal(new Date('2026-11-01T04:00:00Z'), 'America/La_Paz').toISOString(),
    ).toBe('2026-11-01T04:00:00.000Z');
  });

  it('el día local sirve de clave de «una vez por día»', () => {
    expect(diaLocal(new Date('2026-10-10T02:00:00Z'), 'America/La_Paz')).toBe('2026-10-09');
    expect(diaLocal(new Date('2026-10-10T04:00:00Z'), 'America/La_Paz')).toBe('2026-10-10');
  });
});

describe('catálogo de los topes (ADR 0030 §7)', () => {
  it('trae las siete claves y reconoce solo esas', () => {
    expect(CLAVES_DE_LIMITE).toHaveLength(7);
    expect(Object.values(CLAVES).every((clave) => definicionDe(clave) !== null)).toBe(true);
    expect(definicionDe('qr.inventado')).toBeNull();
  });

  it('valida el entero contra los extremos de la clave', () => {
    const diario = definicionDe(CLAVES.topeDiario);
    expect(diario).not.toBeNull();
    if (diario === null) return;
    expect(valorValido(diario, 1)).toBe(true);
    expect(valorValido(diario, 0)).toBe(false);
    expect(valorValido(diario, 1.5)).toBe(false);
    expect(valorValido(diario, diario.maximo + 1)).toBe(false);
  });

  it('el valor que rige: usuario, luego cuenta, luego plan, luego general', () => {
    const base = { deUsuario: null, deCuenta: null, dePlan: null, global: 10 };
    expect(valorEfectivo(base)).toBe(10);
    expect(valorEfectivo({ ...base, dePlan: 20 })).toBe(20);
    expect(valorEfectivo({ ...base, dePlan: 20, deCuenta: 30 })).toBe(30);
    expect(valorEfectivo({ ...base, dePlan: 20, deCuenta: 30, deUsuario: 0 })).toBe(0);
  });
});
