import {
  minutosRestantes,
  puedeCancelarVinculo,
  puedeDarDeBaja,
  puedeLiberar,
  puedeVincular,
  type Placa,
} from '@/features/placas/domain/placa';

const base: Placa = {
  id: '1',
  mac: 'AA:BB:CC:00:11:22',
  estado: 'detectada',
  firmware: null,
  ip: null,
  ultimoContactoEn: null,
  enLinea: false,
  porConfirmarHasta: null,
  dispositivo: null,
  cuenta: null,
  puerta: null,
};

describe('placas: acciones según el estado', () => {
  it('se vincula solo una placa detectada', () => {
    expect(puedeVincular(base)).toBe(true);
    expect(puedeVincular({ ...base, estado: 'por_confirmar' })).toBe(false);
    expect(puedeVincular({ ...base, estado: 'vinculada' })).toBe(false);
  });

  it('se cancela el vínculo solo de la que espera su botón', () => {
    expect(puedeCancelarVinculo({ ...base, estado: 'por_confirmar' })).toBe(true);
    expect(puedeCancelarVinculo(base)).toBe(false);
    expect(puedeCancelarVinculo({ ...base, estado: 'vinculada' })).toBe(false);
  });

  it('se libera solo una vinculada y se da de baja toda la que no lo está', () => {
    expect(puedeLiberar(base)).toBe(false);
    expect(puedeLiberar({ ...base, estado: 'vinculada' })).toBe(true);
    expect(puedeDarDeBaja(base)).toBe(true);
    expect(puedeDarDeBaja({ ...base, estado: 'por_confirmar' })).toBe(true);
    expect(puedeDarDeBaja({ ...base, estado: 'vinculada' })).toBe(false);
  });
});

describe('placas: ventana de confirmación', () => {
  it('redondea los minutos restantes hacia arriba y no baja de cero', () => {
    const ahora = new Date('2026-10-14T12:00:00Z');
    expect(minutosRestantes(new Date('2026-10-14T12:10:00Z'), ahora)).toBe(10);
    expect(minutosRestantes(new Date('2026-10-14T12:00:30Z'), ahora)).toBe(1);
    expect(minutosRestantes(new Date('2026-10-14T11:00:00Z'), ahora)).toBe(0);
  });
});
