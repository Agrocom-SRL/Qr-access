import { i18next } from '.';
import { formatearFecha, formatearHora, formatearMonto } from './formatos';
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
