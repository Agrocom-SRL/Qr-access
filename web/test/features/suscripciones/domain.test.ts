import {
  admiteCambios,
  diferenciaDePrecio,
  esMejora,
  opcionesDeMejora,
  type PlanComparable,
} from '@/features/suscripciones/domain/suscripcion';

const plan = (id: string, cupo: number | null, precio: number): PlanComparable => ({
  id,
  nombre: `${String(cupo)} usuarios`,
  cupoUsuarios: cupo,
  precioAnual: precio,
});
const p100 = plan('1', 100, 12000);
const p200 = plan('2', 200, 21600);
const p350 = plan('3', 350, 33600);
const sinTope = plan('4', null, 90000);

describe('esMejora / opcionesDeMejora', () => {
  it('solo es mejora un plan con más cupo', () => {
    expect(esMejora(p100, p200)).toBe(true);
    expect(esMejora(p200, p100)).toBe(false);
    expect(esMejora(p200, p200)).toBe(false);
  });

  it('sin tope es lo más alto: se puede subir a él y no hay mejora desde él', () => {
    expect(esMejora(p350, sinTope)).toBe(true);
    expect(esMejora(sinTope, p350)).toBe(false);
  });

  it('las opciones son solo los planes mayores, del más chico al más grande', () => {
    expect(opcionesDeMejora([p350, p100, p200, sinTope], p100).map((p) => p.id)).toEqual([
      '2',
      '3',
      '4',
    ]);
    expect(opcionesDeMejora([p100, p200, p350], p350)).toEqual([]);
  });
});

describe('diferenciaDePrecio', () => {
  it('es el precio nuevo menos el actual', () => {
    expect(diferenciaDePrecio(p100, p200)).toBe(9600);
    expect(diferenciaDePrecio(p100, p350)).toBe(21600);
  });
});

describe('admiteCambios', () => {
  it('una suscripción suspendida no admite renovar ni cambiar de plan', () => {
    expect(admiteCambios('suspendida')).toBe(false);
    for (const estado of ['activa', 'porVencer', 'vencida'] as const) {
      expect(admiteCambios(estado)).toBe(true);
    }
  });
});
