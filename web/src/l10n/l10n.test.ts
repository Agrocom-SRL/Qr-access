import { i18next } from '.';
import {
  formatearCuentaRegresiva,
  formatearFecha,
  formatearHora,
  formatearMonto,
  relacionDeDia,
} from './formatos';
import { traducirError } from './traducirError';

describe('formatos', () => {
  it('monto en bolivianos sin decimales y con punto de miles', () => {
    expect(formatearMonto(12000)).toBe('Bs 12.000');
    expect(formatearMonto(950)).toBe('Bs 950');
  });

  it('fecha dd/mm/aaaa y hora HH:mm en La Paz', () => {
    expect(formatearFecha('2026-10-12T03:00:00Z')).toBe('11/10/2026');
    expect(formatearHora('2026-10-12T15:05:00Z')).toBe('11:05');
  });
});

describe('traducirError', () => {
  const t = i18next.t.bind(i18next);

  it('traduce el código de la API', () => {
    expect(traducirError(t, 'sesion.credenciales_invalidas')).toBe('Credenciales incorrectas');
  });

  it('un código desconocido cae en el mensaje genérico', () => {
    expect(traducirError(t, 'algo.nuevo')).toBe(
      'Algo falló de nuestro lado. Intenta de nuevo en unos segundos.',
    );
    expect(traducirError(t, undefined)).toContain('Algo falló');
  });
});

describe('cuenta regresiva y día relativo', () => {
  it('formatea mm:ss', () => {
    expect(formatearCuentaRegresiva(272)).toBe('04:32');
    expect(formatearCuentaRegresiva(0)).toBe('00:00');
    expect(formatearCuentaRegresiva(-3)).toBe('00:00');
  });

  it('hoy, ayer u otro según la zona de La Paz', () => {
    const ahora = new Date('2026-10-12T16:00:00Z');
    expect(relacionDeDia('2026-10-12T12:12:00Z', ahora)).toBe('hoy');
    expect(relacionDeDia('2026-10-11T22:30:00Z', ahora)).toBe('ayer');
    expect(relacionDeDia('2026-09-02T12:00:00Z', ahora)).toBe('otro');
  });
});
