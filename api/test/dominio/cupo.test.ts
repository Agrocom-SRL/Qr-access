import { describe, expect, it } from 'vitest';
import { calcularCupo } from '../../src/modules/seguridad/domain/cupo.js';

describe('cupo de usuarios (ADR 0028 §6)', () => {
  it('sin máximo en el plan no hay porcentaje ni aviso', () => {
    expect(calcularCupo(40, null)).toEqual({
      usados: 40,
      maximo: null,
      porcentaje: null,
      aviso: null,
    });
  });

  it.each([
    [0, 100, 0, null],
    [79, 100, 79, null],
    [80, 100, 80, 'cerca_del_limite'],
    [99, 100, 99, 'cerca_del_limite'],
    [100, 100, 100, 'limite_alcanzado'],
    [120, 100, 120, 'limite_alcanzado'],
    // El porcentaje se redondea hacia abajo: 79,9 % todavía no avisa
    [799, 1000, 79, null],
  ])('%i de %i usa el %i %% y avisa %s', (usados, maximo, porcentaje, aviso) => {
    expect(calcularCupo(usados, maximo)).toMatchObject({ porcentaje, aviso });
  });

  it('un máximo de cero no divide por cero: se trata como sin límite', () => {
    expect(calcularCupo(3, 0)).toMatchObject({ porcentaje: null, aviso: null });
  });
});
