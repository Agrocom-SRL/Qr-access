import { parsearCupo, parsearPrecio, validarPlan } from '@/features/planes/domain/plan';

describe('parsearPrecio', () => {
  it('acepta enteros con o sin puntos de miles', () => {
    expect(parsearPrecio('12000')).toBe(12000);
    expect(parsearPrecio('12.000')).toBe(12000);
    expect(parsearPrecio(' 33.600 ')).toBe(33600);
    expect(parsearPrecio('0')).toBe(0);
  });

  it('rechaza vacío, texto, negativos y decimales', () => {
    for (const texto of ['', 'abc', '-5', '12,5', '1e3']) expect(parsearPrecio(texto)).toBeNull();
  });
});

describe('parsearCupo / validarPlan', () => {
  it('el cupo es un entero de 1 en adelante', () => {
    expect(parsearCupo('500')).toBe(500);
    for (const texto of ['0', '', '1,5', '-2', 'a']) expect(parsearCupo(texto)).toBeNull();
  });

  it('valida el formulario completo', () => {
    expect(validarPlan({ nombre: '500 usuarios', cupo: '500', precio: '45.000' })).toEqual({});
    expect(validarPlan({ nombre: ' ', cupo: '', precio: '' })).toEqual({
      nombre: 'requerido',
      cupo: 'requerido',
      precio: 'requerido',
    });
    expect(validarPlan({ nombre: 'X', cupo: '0', precio: '1,5' })).toEqual({
      cupo: 'cupoInvalido',
      precio: 'precioInvalido',
    });
  });
});
