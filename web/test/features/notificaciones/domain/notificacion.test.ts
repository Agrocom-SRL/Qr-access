import {
  agruparPorSitio,
  nuevasDesde,
  type Notificacion,
} from '@/features/notificaciones/domain/notificacion';

const cuentaAgr = { id: '1', codigo: 'AGR', nombre: 'Agroindustrial Norte' };
const cuentaFro = { id: '2', codigo: 'FRO', nombre: 'Frigorífico Oriente' };

function aviso(id: string, cuenta: Notificacion['cuenta'], sitio: Notificacion['sitio']) {
  return {
    id,
    tipo: 'placa.caida_sostenida',
    severidad: 'aviso',
    cuenta,
    sitio,
    leida: false,
    placas: [],
    novedadEn: new Date('2026-10-27T12:00:00Z'),
    creadaEn: new Date('2026-10-27T12:00:00Z'),
  } as Notificacion;
}

describe('bandeja de AGROCOM: agrupar por sitio', () => {
  it('junta los avisos de un mismo sitio y respeta el orden de llegada', () => {
    const grupos = agruparPorSitio([
      aviso('1', cuentaAgr, { id: '10', nombre: 'Planta Warnes' }),
      aviso('2', cuentaFro, { id: '20', nombre: 'Depósito Este' }),
      aviso('3', cuentaAgr, { id: '10', nombre: 'Planta Warnes' }),
    ]);
    expect(grupos.map((g) => g.notificaciones.map((n) => n.id))).toEqual([['1', '3'], ['2']]);
  });

  it('separa dos sitios de una misma cuenta y pone el aviso sin sitio en el grupo de la cuenta', () => {
    const grupos = agruparPorSitio([
      aviso('1', cuentaAgr, { id: '10', nombre: 'Planta Warnes' }),
      aviso('2', cuentaAgr, { id: '11', nombre: 'Oficinas' }),
      aviso('3', cuentaAgr, null),
    ]);
    expect(grupos).toHaveLength(3);
    expect(grupos[2]?.sitio).toBeNull();
    expect(grupos[2]?.cuenta.codigo).toBe('AGR');
  });

  it('sin avisos no hay grupos', () => {
    expect(agruparPorSitio([])).toEqual([]);
  });
});

describe('bandeja de AGROCOM: avisos nuevos', () => {
  it('la primera lectura no cuenta como novedad', () => {
    expect(nuevasDesde(undefined, 5)).toBe(0);
  });

  it('cuenta solo el aumento respecto de la lectura anterior', () => {
    expect(nuevasDesde(2, 5)).toBe(3);
    expect(nuevasDesde(5, 2)).toBe(0);
    expect(nuevasDesde(4, 4)).toBe(0);
  });
});
