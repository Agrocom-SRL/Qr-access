import {
  FILTROS_INICIALES_DE_EXPORTACION,
  POR_PAGINA_DE_EXPORTACION,
  claveDeExportacion,
  conBomDeExcel,
  consultaDeExportacion,
  diaSiguiente,
  inicioDelDia,
  nombreDeArchivo,
  paginaSiguiente,
  paginasDe,
  rangoValido,
  type FiltrosDeExportacion,
  type ResumenDePagina,
} from '@/features/exportacion/domain/exportacion';

const RESUMEN: ResumenDePagina = {
  pagina: 1,
  porPagina: 1000,
  total: 2500,
  filas: 1000,
  hayMas: true,
  truncado: false,
};

describe('fechas de la exportación en La Paz (UTC-4, sin horario de verano)', () => {
  it('un día empieza a las 00:00 con desfase de La Paz', () => {
    expect(inicioDelDia('2026-10-01')).toBe('2026-10-01T00:00:00-04:00');
  });

  it('el día siguiente cruza bien fin de mes y de año', () => {
    expect(diaSiguiente('2026-10-31')).toBe('2026-11-01');
    expect(diaSiguiente('2026-12-31')).toBe('2027-01-01');
    expect(diaSiguiente('2026-02-28')).toBe('2026-03-01');
  });

  it('un rango con el inicio después del fin no vale; uno abierto o de un día, sí', () => {
    expect(
      rangoValido({
        ...FILTROS_INICIALES_DE_EXPORTACION,
        desde: '2026-10-05',
        hasta: '2026-10-01',
      }),
    ).toBe(false);
    expect(rangoValido({ ...FILTROS_INICIALES_DE_EXPORTACION, desde: '2026-10-05' })).toBe(true);
    expect(
      rangoValido({
        ...FILTROS_INICIALES_DE_EXPORTACION,
        desde: '2026-10-05',
        hasta: '2026-10-05',
      }),
    ).toBe(true);
  });
});

describe('consulta de una página', () => {
  const filtros: FiltrosDeExportacion = {
    resultado: 'rechazado',
    desde: '2026-10-01',
    hasta: '2026-10-05',
  };

  it('pide la página con el máximo por página y, en lecturas, los filtros con el fin exclusivo', () => {
    expect(consultaDeExportacion('lecturas', 2, filtros)).toEqual({
      pagina: 2,
      por_pagina: POR_PAGINA_DE_EXPORTACION,
      resultado: 'rechazado',
      desde: '2026-10-01T00:00:00-04:00',
      // El día 5 entero entra: el fin es el inicio del día 6.
      hasta: '2026-10-06T00:00:00-04:00',
    });
  });

  it('con resultado «todos» no manda el resultado', () => {
    const consulta = consultaDeExportacion('lecturas', 1, { ...filtros, resultado: 'todos' });
    expect(consulta).not.toHaveProperty('resultado');
  });

  it('usuarios y puertas no llevan filtros: solo página y tamaño', () => {
    expect(consultaDeExportacion('usuarios', 1, filtros)).toEqual({
      pagina: 1,
      por_pagina: POR_PAGINA_DE_EXPORTACION,
    });
    expect(consultaDeExportacion('puertas', 3, filtros)).toEqual({
      pagina: 3,
      por_pagina: POR_PAGINA_DE_EXPORTACION,
    });
  });
});

describe('paginación', () => {
  it('cuenta las páginas del total y nunca baja de una', () => {
    expect(paginasDe(0, 1000)).toBe(1);
    expect(paginasDe(1000, 1000)).toBe(1);
    expect(paginasDe(1001, 1000)).toBe(2);
    expect(paginasDe(10000, 1000)).toBe(10);
  });

  it('la siguiente página es la que sigue si hay más; si no, vuelve a la primera', () => {
    expect(paginaSiguiente(null)).toBe(1);
    expect(paginaSiguiente(RESUMEN)).toBe(2);
    expect(paginaSiguiente({ ...RESUMEN, pagina: 2, hayMas: false })).toBe(1);
  });

  it('cambiar un filtro cambia la clave: la página vieja deja de servir para seguir', () => {
    const base = claveDeExportacion('lecturas', FILTROS_INICIALES_DE_EXPORTACION);
    expect(
      claveDeExportacion('lecturas', { ...FILTROS_INICIALES_DE_EXPORTACION, desde: '2026-10-01' }),
    ).not.toBe(base);
    expect(claveDeExportacion('usuarios', FILTROS_INICIALES_DE_EXPORTACION)).not.toBe(base);
  });
});

describe('archivo', () => {
  it('el nombre lleva el recurso, el código en minúsculas y la página', () => {
    expect(nombreDeArchivo('lecturas', 'AGR', 2)).toBe('lecturas-agr-p2.csv');
  });

  it('Excel recibe el archivo con la marca de orden de bytes delante, en UTF-8', () => {
    const csv = new Blob(['nombre\nÑandú\n'], { type: 'text/csv' });
    const conBom = conBomDeExcel(csv);
    expect(conBom.size).toBe(csv.size + 3);
    expect(conBom.type).toBe('text/csv;charset=utf-8');
  });
});
