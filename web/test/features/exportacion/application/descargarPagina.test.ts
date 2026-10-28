import { descargarPagina } from '@/features/exportacion/application/descargarPagina';
import type { ExportacionesRepositorio } from '@/features/exportacion/api/ExportacionesRepositorio';
import {
  FILTROS_INICIALES_DE_EXPORTACION,
  type PaginaDeExportacion,
} from '@/features/exportacion/domain/exportacion';

function repositorioCon(pagina: PaginaDeExportacion): ExportacionesRepositorio {
  return { pagina: vi.fn(() => Promise.resolve(pagina)) };
}

const CSV = new Blob(['codigo\nUSR1\n'], { type: 'text/csv' });

describe('descargar una página de la exportación', () => {
  it('baja el archivo con su nombre y devuelve solo el resumen, no el CSV', async () => {
    const descargar = vi.fn<(nombre: string, contenido: Blob) => void>();
    const repositorio = repositorioCon({
      csv: CSV,
      resumen: { pagina: 1, porPagina: 1000, total: 1, filas: 1, hayMas: false, truncado: false },
    });

    const resumen = await descargarPagina(
      repositorio,
      '7',
      'AGR',
      { recurso: 'usuarios', pagina: 1, filtros: FILTROS_INICIALES_DE_EXPORTACION },
      descargar,
    );

    expect(repositorio.pagina).toHaveBeenCalledWith('7', 'usuarios', {
      pagina: 1,
      filtros: FILTROS_INICIALES_DE_EXPORTACION,
    });
    expect(descargar).toHaveBeenCalledWith('usuarios-agr-p1.csv', expect.any(Blob));
    expect(resumen).toEqual({
      pagina: 1,
      porPagina: 1000,
      total: 1,
      filas: 1,
      hayMas: false,
      truncado: false,
    });
    expect(resumen).not.toHaveProperty('csv');
  });

  it('sin filas no baja ningún archivo', async () => {
    const descargar = vi.fn<(nombre: string, contenido: Blob) => void>();
    const resumen = await descargarPagina(
      repositorioCon({
        csv: new Blob(['codigo\n'], { type: 'text/csv' }),
        resumen: { pagina: 1, porPagina: 1000, total: 0, filas: 0, hayMas: false, truncado: false },
      }),
      '7',
      'AGR',
      { recurso: 'lecturas', pagina: 1, filtros: FILTROS_INICIALES_DE_EXPORTACION },
      descargar,
    );
    expect(descargar).not.toHaveBeenCalled();
    expect(resumen.total).toBe(0);
  });
});
