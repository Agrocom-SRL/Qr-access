import { cambiarIdioma, i18next, recursos } from '@/l10n';
import {
  formatearCuentaRegresiva,
  formatearFecha,
  formatearHora,
  formatearMonto,
  formatearNumero,
  relacionDeDia,
} from '@/l10n/formatos';
import { traducirError } from '@/l10n/traducirError';

describe('formatos', () => {
  it('monto en bolivianos sin decimales y con punto de miles', () => {
    expect(formatearMonto(12000)).toBe('Bs 12.000');
    expect(formatearMonto(950)).toBe('Bs 950');
    expect(formatearMonto(1500)).toBe('Bs 1.500');
    expect(formatearNumero(1604)).toBe('1.604');
    expect(formatearNumero(7650)).toBe('7.650');
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

describe('idiomas del panel', () => {
  type Arbol = { [clave: string]: string | Arbol };

  /** Todas las claves hoja de un namespace, con sus variables `{{x}}`. */
  const hojas = (arbol: Arbol, prefijo = ''): [string, string][] =>
    Object.entries(arbol).flatMap(([clave, valor]) =>
      typeof valor === 'string'
        ? [[`${prefijo}${clave}`, valor] as [string, string]]
        : hojas(valor, `${prefijo}${clave}.`),
    );
  const variables = (texto: string) =>
    [...texto.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
  /** `_one` y `_other` son la misma clave para i18next: se comparan por la base. */
  const base = (clave: string) => clave.replace(/_(one|other|many|zero|two|few)$/, '');

  for (const idioma of ['en', 'pt'] as const) {
    it(`${idioma} tiene las mismas claves y variables que es`, () => {
      for (const [ns, es] of Object.entries(recursos.es)) {
        const otro = recursos[idioma][ns as keyof (typeof recursos)['es']] as Arbol;
        const deEs = new Map(hojas(es as Arbol).map(([c, v]) => [base(c), variables(v)]));
        const deOtro = new Map(hojas(otro).map(([c, v]) => [base(c), variables(v)]));
        expect([...deOtro.keys()].sort(), `${idioma}/${ns}: claves`).toEqual(
          [...deEs.keys()].sort(),
        );
        for (const [clave, vars] of deEs) {
          expect(deOtro.get(clave), `${idioma}/${ns}/${clave}: variables`).toEqual(vars);
        }
      }
    });
  }

  it('cambia el texto y los formatos al cambiar de idioma, y lo recuerda', async () => {
    await cambiarIdioma('en');
    expect(i18next.t('nav:cuentas')).toBe('Accounts');
    expect(formatearFecha('2026-10-12T03:00:00Z')).toBe('10/11/2026');
    expect(localStorage.getItem('acceso.idioma')).toBe('en');
    await cambiarIdioma('pt');
    expect(i18next.t('nav:cuentas')).toBe('Contas');
    expect(document.documentElement.lang).toBe('pt');
    await cambiarIdioma('es');
    expect(i18next.t('nav:cuentas')).toBe('Cuentas');
  });
});
