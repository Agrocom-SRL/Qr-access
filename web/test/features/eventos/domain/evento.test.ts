import { causaDeEjecucion } from '@/features/eventos/domain/evento';

describe('lecturas: causa de la ejecución', () => {
  it('reconoce las causas que informa la placa (ADR 0031 §18)', () => {
    expect(causaDeEjecucion('puerta_no_abrio')).toBe('puerta_no_abrio');
    expect(causaDeEjecucion('sin_respuesta')).toBe('sin_respuesta');
  });

  it('una causa desconocida o ausente no inventa texto', () => {
    expect(causaDeEjecucion('causa_nueva')).toBeNull();
    expect(causaDeEjecucion(null)).toBeNull();
  });
});
