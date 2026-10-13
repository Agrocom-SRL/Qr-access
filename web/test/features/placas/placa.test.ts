import {
  agruparCodigo,
  normalizarMac,
  puedeDarDeBaja,
  puedeLiberar,
  puedeVincular,
  type Placa,
} from '@/features/placas/domain/placa';

const base: Placa = {
  id: '1',
  mac: 'AA:BB:CC:00:11:22',
  estado: 'de_fabrica',
  firmware: null,
  ip: null,
  ultimoContactoEn: null,
  enLinea: false,
  reclamoHecho: true,
  dispositivo: null,
  cuenta: null,
  puerta: null,
};

describe('placas: acciones según el estado', () => {
  it('se vincula una placa libre que ya reclamó, no una que nunca se conectó ni una vinculada', () => {
    expect(puedeVincular(base)).toBe(true);
    expect(puedeVincular({ ...base, reclamoHecho: false })).toBe(false);
    expect(puedeVincular({ ...base, estado: 'vinculada' })).toBe(false);
  });

  it('se libera solo una vinculada y se da de baja solo una libre', () => {
    expect(puedeLiberar(base)).toBe(false);
    expect(puedeLiberar({ ...base, estado: 'vinculada' })).toBe(true);
    expect(puedeDarDeBaja(base)).toBe(true);
    expect(puedeDarDeBaja({ ...base, estado: 'vinculada' })).toBe(false);
  });
});

describe('placas: MAC y código', () => {
  it('normaliza la MAC a mayúsculas con dos puntos', () => {
    expect(normalizarMac('aa-bb-cc-00-11-22')).toBe('AA:BB:CC:00:11:22');
    expect(normalizarMac('  aa:bb:cc:00:11:22 ')).toBe('AA:BB:CC:00:11:22');
  });

  it('rechaza lo que no es una MAC', () => {
    for (const texto of [
      '',
      'zz:zz:zz:zz:zz:zz',
      'AA:BB:CC:00:11',
      'AABBCC001122',
      'AA:BB:CC:00:11:22:33',
    ]) {
      expect(normalizarMac(texto)).toBeNull();
    }
  });

  it('agrupa el código de 16 caracteres de a 4', () => {
    expect(agruparCodigo('0123456789ABCDEF')).toBe('0123-4567-89AB-CDEF');
  });
});
