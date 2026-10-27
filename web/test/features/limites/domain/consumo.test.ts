import { anchoDeBarra } from '@/features/limites/domain/consumo';

describe('barra del consumo de la bolsa', () => {
  it('el ancho es el porcentaje, sin pasar de 100', () => {
    expect(anchoDeBarra(45)).toBe(45);
    expect(anchoDeBarra(115)).toBe(100);
  });

  it('sin bolsa no hay barra que dibujar', () => {
    expect(anchoDeBarra(null)).toBe(0);
  });

  it('nunca es negativo', () => {
    expect(anchoDeBarra(-3)).toBe(0);
  });
});
