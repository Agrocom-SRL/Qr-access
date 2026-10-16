import { describe, expect, it } from 'vitest';
import { inicioDelDia, sumarMeses } from '../../src/platform/tiempo/fechas.js';

describe('inicioDelDia', () => {
  it('la medianoche de La Paz es 04:00 UTC', () => {
    expect(inicioDelDia('2026-10-12').toISOString()).toBe('2026-10-12T04:00:00.000Z');
  });

  it('respeta otra zona', () => {
    expect(inicioDelDia('2026-10-12', 'UTC').toISOString()).toBe('2026-10-12T00:00:00.000Z');
  });
});

describe('sumarMeses', () => {
  it('suma 12 meses de calendario', () => {
    expect(sumarMeses(new Date('2026-10-12T04:00:00Z'), 12).toISOString()).toBe(
      '2027-10-12T04:00:00.000Z',
    );
  });

  it('no se pasa de fin de mes', () => {
    expect(sumarMeses(new Date('2026-01-31T04:00:00Z'), 1).toISOString()).toBe(
      '2026-02-28T04:00:00.000Z',
    );
    expect(sumarMeses(new Date('2028-02-29T04:00:00Z'), 12).toISOString()).toBe(
      '2029-02-28T04:00:00.000Z',
    );
  });
});
