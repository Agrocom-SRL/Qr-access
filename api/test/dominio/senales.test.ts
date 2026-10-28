import { describe, expect, it } from 'vitest';
import {
  aperturasPorUsuario,
  armarSerieDeFlujo,
  baseHabitual,
  claveDeAvisoDeBolsa,
  claveDeFlujoAtipico,
  claveDeSenal,
  diasEntre,
  esFlujoAtipico,
  estadoDeBolsa,
  gravedadDeQrReenviado,
  gravedadDeUsoMasivo,
  mayorGravedad,
  mediana,
  porcentajeDeBolsa,
  restarDias,
  seAvisa,
} from '../../src/modules/senales/domain/reglas.js';

describe('reglas de las señales de abuso (puras)', () => {
  it('las claves identifican el hecho y el día', () => {
    expect(claveDeSenal('uso_masivo', '7', '2026-11-10')).toBe('uso_masivo:7:2026-11-10');
    expect(claveDeFlujoAtipico('2026-11-10')).toBe('flujo.atipico:2026-11-10');
    expect(claveDeAvisoDeBolsa('bolsa.aviso:2026-11', '3')).toBe('bolsa:bolsa.aviso:2026-11');
    expect(claveDeAvisoDeBolsa(null, '3')).toBe('bolsa:id3');
  });

  it('uso masivo: media por encima del N y alta desde el triple', () => {
    expect(gravedadDeUsoMasivo(13, 12)).toBe('media');
    expect(gravedadDeUsoMasivo(35, 12)).toBe('media');
    expect(gravedadDeUsoMasivo(36, 12)).toBe('alta');
  });

  it('QR reenviado: lo que distingue el reenvío son los lectores distintos', () => {
    // (volumen, intentos distintos, lectores, mínimo)
    expect(gravedadDeQrReenviado(2, 2, 2, 3)).toBeNull(); // bajo el mínimo
    expect(gravedadDeQrReenviado(3, 3, 1, 3)).toBeNull(); // un lector que relee: normal
    expect(gravedadDeQrReenviado(8, 8, 1, 3)).toBeNull();
    expect(gravedadDeQrReenviado(9, 9, 1, 3)).toBe('baja'); // insistencia extrema, solo constancia
    expect(gravedadDeQrReenviado(3, 3, 2, 3)).toBe('media');
    expect(gravedadDeQrReenviado(3, 3, 3, 3)).toBe('alta');
    expect(gravedadDeQrReenviado(3, 3, 7, 3)).toBe('alta');
  });

  it('QR reenviado: las repeticiones hacen volumen, pero no sustituyen intentos distintos (integración W7)', () => {
    // Un intento distinto releído 9 veces: 10 filas, 1 intento, 1 lector: solo constancia baja.
    expect(gravedadDeQrReenviado(10, 1, 1, 3)).toBe('baja');
    // Dos lectores, pero con un solo intento distinto entre ambos: no es «media», solo constancia baja si hay volumen.
    expect(gravedadDeQrReenviado(10, 2, 2, 3)).toBe('baja');
    expect(gravedadDeQrReenviado(5, 2, 2, 3)).toBeNull();
    // Tres lectores con intentos distintos suficientes: alta aunque haya además repeticiones.
    expect(gravedadDeQrReenviado(30, 3, 3, 3)).toBe('alta');
  });

  it('solo la gravedad media o alta se avisa, y la peor manda', () => {
    expect(seAvisa('baja')).toBe(false);
    expect(seAvisa('media')).toBe(true);
    expect(seAvisa('alta')).toBe(true);
    expect(mayorGravedad(['baja', 'media'])).toBe('media');
    expect(mayorGravedad(['baja', 'alta', 'media'])).toBe('alta');
    expect(mayorGravedad(['baja'])).toBe('baja');
  });

  it('flujo atípico: el mínimo de aperturas Y la tasa por usuario activo', () => {
    const umbrales = { aperturasMinimo: 50, aperturasPorUsuario: 25 };
    expect(esFlujoAtipico({ aperturas: 60, usuariosActivos: 2 }, umbrales)).toBe(true);
    expect(esFlujoAtipico({ aperturas: 50, usuariosActivos: 2 }, umbrales)).toBe(true); // 25 exactos
    expect(esFlujoAtipico({ aperturas: 49, usuariosActivos: 1 }, umbrales)).toBe(false); // bajo el mínimo
    expect(esFlujoAtipico({ aperturas: 200, usuariosActivos: 100 }, umbrales)).toBe(false); // 2 por usuario
    expect(esFlujoAtipico({ aperturas: 60, usuariosActivos: 0 }, umbrales)).toBe(true); // sin dividir por cero
    expect(aperturasPorUsuario({ aperturas: 10, usuariosActivos: 3 })).toBe(3.3);
  });

  it('la mediana y la base habitual ignoran los días sin actividad', () => {
    expect(mediana([])).toBeNull();
    expect(mediana([5])).toBe(5);
    expect(mediana([1, 9, 3])).toBe(3);
    expect(mediana([1, 2, 3, 4])).toBe(2.5);
    expect(baseHabitual([0, 0, 10, 20, 0, 30])).toBe(20);
    expect(baseHabitual([0, 0])).toBeNull();
  });

  it('el calendario: días entre dos fechas y restar días', () => {
    expect(diasEntre('2026-11-29', '2026-12-02')).toEqual([
      '2026-11-29',
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
    ]);
    expect(diasEntre('2026-11-10', '2026-11-10')).toEqual(['2026-11-10']);
    expect(diasEntre('2026-11-11', '2026-11-10')).toEqual([]);
    expect(restarDias('2026-03-01', 1)).toBe('2026-02-28');
    expect(restarDias('2026-01-01', 1)).toBe('2025-12-31');
  });

  it('la bolsa: normal, aviso desde el porcentaje, superada solo pasado el 100 %, sin tope', () => {
    expect(estadoDeBolsa(0, 5000, 80)).toBe('normal');
    expect(estadoDeBolsa(3999, 5000, 80)).toBe('normal');
    expect(estadoDeBolsa(4000, 5000, 80)).toBe('aviso');
    expect(estadoDeBolsa(5000, 5000, 80)).toBe('aviso'); // justo al 100 % todavía no se pasó
    expect(estadoDeBolsa(5001, 5000, 80)).toBe('superada');
    expect(estadoDeBolsa(10, null, 80)).toBe('sin_tope');
    expect(estadoDeBolsa(10, 0, 80)).toBe('sin_tope');
    expect(porcentajeDeBolsa(4500, 5000)).toBe(90);
    expect(porcentajeDeBolsa(1, 3)).toBe(33.3);
    expect(porcentajeDeBolsa(1, null)).toBeNull();
  });

  it('la serie marca los días atípicos con su base de los días anteriores', () => {
    const dias = diasEntre('2026-11-01', '2026-11-05');
    const actividad = new Map([
      ['2026-11-01', { aperturas: 10, rechazos: 1, generados: 2 }],
      ['2026-11-02', { aperturas: 10, rechazos: 0, generados: 0 }],
      ['2026-11-04', { aperturas: 80, rechazos: 0, generados: 5 }],
    ]);
    const serie = armarSerieDeFlujo({
      dias,
      mostrar: 3,
      actividad,
      usuariosActivos: 2,
      umbrales: { aperturasMinimo: 50, aperturasPorUsuario: 25 },
    });
    expect(serie.map((d) => d.dia)).toEqual(['2026-11-03', '2026-11-04', '2026-11-05']);
    expect(serie[0]).toMatchObject({ aperturas: 0, atipico: false, base: 10 });
    expect(serie[1]).toMatchObject({
      aperturas: 80,
      por_usuario: 40,
      atipico: true,
      base: 10,
      veces_la_base: 8,
      generados: 5,
    });
    expect(serie[2]).toMatchObject({ aperturas: 0, atipico: false });
  });
});
