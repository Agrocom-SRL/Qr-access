import { cambiosDePrecio, parsearPrecio, type Plan } from '@/features/planes/domain/plan';

const plan = (id: string, precioAnual: number): Plan => ({
  id,
  nombre: `Plan ${id}`,
  cupoUsuarios: 100,
  precioAnual,
  cuentas: 0,
  usuariosEnUso: 0,
});

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

describe('cambiosDePrecio', () => {
  it('solo devuelve los planes cuyo precio cambió', () => {
    const planes = [plan('1', 12000), plan('2', 21600)];
    expect(cambiosDePrecio(planes, { '1': 12000, '2': 22000 })).toEqual([
      { planId: '2', precioAnual: 22000 },
    ]);
  });

  it('sin borrador no hay cambios', () => {
    expect(cambiosDePrecio([plan('1', 1)], {})).toEqual([]);
  });
});
