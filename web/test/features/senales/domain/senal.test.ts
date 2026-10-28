import { detalleDeSenal, medidasDe } from '@/features/senales/domain/senal';

describe('lectura del código de una señal', () => {
  it('convierte los pares del código en números', () => {
    expect(medidasDe('aperturas=13;umbral=12')).toEqual({ aperturas: 13, umbral: 12 });
  });

  it('descarta lo que no es un número y los pares vacíos', () => {
    expect(medidasDe('aperturas=trece;umbral=;;umbral=8')).toEqual({ umbral: 8 });
    expect(medidasDe(null)).toEqual({});
  });

  it('un uso masivo se describe con sus números', () => {
    expect(detalleDeSenal('uso_masivo', 'aperturas=13;umbral=12')).toEqual({
      clave: 'uso_masivo',
      valores: { aperturas: 13, umbral: 12 },
    });
  });

  it('un uso imposible sin juzgar puertas no las menciona', () => {
    expect(detalleDeSenal('uso_imposible', 'pares=2;sitios_min=10;puertas_s=0')).toEqual({
      clave: 'uso_imposible',
      valores: { pares: 2, sitios: 10 },
    });
  });

  it('un uso imposible con puertas las incluye', () => {
    expect(detalleDeSenal('uso_imposible', 'pares=1;sitios_min=10;puertas_s=20')?.clave).toBe(
      'uso_imposible_con_puertas',
    );
  });

  it('un código incompleto o un tipo sin plantilla no se muestra en crudo', () => {
    expect(detalleDeSenal('uso_masivo', 'aperturas=13')).toBeNull();
    expect(detalleDeSenal('perdida_o_robo', 'cualquier=cosa')).toBeNull();
    expect(detalleDeSenal('otro', null)).toBeNull();
  });
});
