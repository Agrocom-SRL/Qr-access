import { describe, expect, it } from 'vitest';
import {
  diasRestantes,
  estadoDeSuscripcion,
} from '../../src/modules/suscripciones/domain/estado.js';

const ahora = new Date('2026-10-12T12:00:00Z');
const en = (dias: number) => new Date(ahora.getTime() + dias * 86_400_000);

describe('estadoDeSuscripcion', () => {
  it('activa con más de 30 días', () => {
    expect(estadoDeSuscripcion({ estado: 'vigente', hasta: en(31) }, ahora)).toBe('activa');
  });

  it('por vencer desde 30 días inclusive', () => {
    expect(estadoDeSuscripcion({ estado: 'vigente', hasta: en(30) }, ahora)).toBe('por_vencer');
    expect(estadoDeSuscripcion({ estado: 'vigente', hasta: en(1) }, ahora)).toBe('por_vencer');
  });

  it('vencida cuando pasó la fecha, incluso si en la base sigue "vigente"', () => {
    expect(estadoDeSuscripcion({ estado: 'vigente', hasta: en(-1) }, ahora)).toBe('vencida');
    expect(estadoDeSuscripcion({ estado: 'vigente', hasta: ahora }, ahora)).toBe('vencida');
  });

  it('suspendida manda sobre el vencimiento', () => {
    expect(estadoDeSuscripcion({ estado: 'suspendida', hasta: en(-50) }, ahora)).toBe('suspendida');
    expect(estadoDeSuscripcion({ estado: 'suspendida', hasta: en(100) }, ahora)).toBe('suspendida');
  });
});

describe('diasRestantes', () => {
  it('redondea hacia arriba y es negativo si venció', () => {
    expect(diasRestantes(en(24), ahora)).toBe(24);
    expect(diasRestantes(new Date(ahora.getTime() + 3_600_000), ahora)).toBe(1);
    expect(diasRestantes(en(-10), ahora)).toBe(-10);
  });
});
