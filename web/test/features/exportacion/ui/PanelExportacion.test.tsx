import { elegirOpcion } from '../../../elegirOpcion';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProveedoresApp } from '@/app/providers/ProveedoresApp';
import type { ExportacionesRepositorio } from '@/features/exportacion/api/ExportacionesRepositorio';
import { PanelExportacion } from '@/features/exportacion/ui/components/PanelExportacion';
import { descargarArchivo } from '@/shared/lib/descargas';
import { ErrorApi, SUPER_ADMIN, crearServiciosDePrueba } from '../../../servicios';

vi.mock('@/shared/lib/descargas', () => ({ descargarArchivo: vi.fn() }));

const CUENTA = { id: '7', codigo: 'AGR' };

/** Una página en forma de respuesta de la API (el CSV es un blob pequeño). */
function pagina(
  pagina: number,
  resumen: Partial<{ total: number; filas: number; hayMas: boolean; truncado: boolean }>,
) {
  return {
    csv: new Blob(['codigo\nUSR1\n'], { type: 'text/csv' }),
    resumen: {
      pagina,
      porPagina: 1000,
      total: 1,
      filas: 1,
      hayMas: false,
      truncado: false,
      ...resumen,
    },
  };
}

function montar(
  permisos: readonly string[],
  exportaciones: Partial<ExportacionesRepositorio> = {},
) {
  const restaurar = vi.fn(() =>
    Promise.resolve({
      usuario: SUPER_ADMIN.usuario,
      debeCambiarContrasena: false,
      permisos: [...permisos],
    }),
  );
  const servicios = crearServiciosDePrueba({ seguridad: { restaurar }, exportaciones });
  servicios.almacen.guardar('a');
  render(
    <ProveedoresApp servicios={servicios} reintentos={0}>
      <MemoryRouter>
        <PanelExportacion cuenta={CUENTA} />
      </MemoryRouter>
    </ProveedoresApp>,
  );
  return { restaurar };
}

const PERMISO = ['accesos.evento.exportar_cuenta'];

beforeEach(() => {
  vi.mocked(descargarArchivo).mockReset();
});

describe('exportar los datos de una cuenta (pantalla de AGROCOM)', () => {
  it('sin el permiso, la sección no aparece', async () => {
    const { restaurar } = montar([]);
    await waitFor(() => {
      expect(restaurar).toHaveBeenCalled();
    });
    await act(() => Promise.resolve());
    expect(screen.queryByRole('heading', { name: 'Exportar datos' })).toBeNull();
  });

  it('baja la primera página con su nombre de archivo y dice qué bajó', async () => {
    const pagina1 = vi.fn(() => Promise.resolve(pagina(1, {})));
    montar(PERMISO, { pagina: pagina1 });
    await userEvent.click(await screen.findByRole('button', { name: 'Descargar CSV' }));

    expect(pagina1).toHaveBeenCalledWith('7', 'usuarios', {
      pagina: 1,
      filtros: { resultado: 'todos', desde: '', hasta: '' },
    });
    expect(descargarArchivo).toHaveBeenCalledWith('usuarios-agr-p1.csv', expect.any(Blob));
    expect(await screen.findByText('Página 1 de 1 descargada: 1 fila.')).toBeInTheDocument();
  });

  it('si hay más páginas, el botón baja la siguiente y dice cuál', async () => {
    const pedidos: number[] = [];
    montar(PERMISO, {
      pagina: vi.fn<ExportacionesRepositorio['pagina']>((_cuenta, _recurso, pedido) => {
        pedidos.push(pedido.pagina);
        return Promise.resolve(
          pedido.pagina === 1
            ? pagina(1, { total: 2500, filas: 1000, hayMas: true })
            : pagina(2, { total: 2500, filas: 1000, hayMas: false }),
        );
      }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Descargar CSV' }));
    const siguiente = await screen.findByRole('button', {
      name: 'Descargar página 2 de 3',
    });
    await userEvent.click(siguiente);
    await waitFor(() => {
      expect(pedidos).toEqual([1, 2]);
    });
    expect(descargarArchivo).toHaveBeenLastCalledWith('usuarios-agr-p2.csv', expect.any(Blob));
    // La última página deja el botón para empezar de nuevo.
    expect(
      await screen.findByRole('button', { name: 'Descargar desde la primera página' }),
    ).toBeInTheDocument();
  });

  it('si el tope corta el total, lo advierte y pide acotar el rango', async () => {
    montar(PERMISO, {
      pagina: () =>
        Promise.resolve(pagina(1, { total: 10000, filas: 1000, hayMas: true, truncado: true })),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Descargar CSV' }));
    expect(
      await screen.findByText(/Hay más filas que el tope de la exportación/),
    ).toBeInTheDocument();
  });

  it('sin filas lo dice y no baja ningún archivo', async () => {
    montar(PERMISO, {
      pagina: () => Promise.resolve(pagina(1, { total: 0, filas: 0 })),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Descargar CSV' }));
    expect(
      await screen.findByText('No hay filas para exportar con estos filtros.'),
    ).toBeInTheDocument();
    expect(descargarArchivo).not.toHaveBeenCalled();
  });

  it('un límite de la API se muestra traducido por su código', async () => {
    montar(PERMISO, {
      pagina: () => Promise.reject(new ErrorApi(429, 'limite.excedido')),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Descargar CSV' }));
    expect(await screen.findByText(/Hiciste demasiadas peticiones seguidas/)).toBeInTheDocument();
    expect(descargarArchivo).not.toHaveBeenCalled();
  });

  it('cambiar el recurso o un filtro descarta la última página: el botón vuelve a empezar', async () => {
    montar(PERMISO, {
      pagina: () => Promise.resolve(pagina(1, { total: 2500, filas: 1000, hayMas: true })),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Descargar CSV' }));
    expect(
      await screen.findByRole('button', { name: 'Descargar página 2 de 3' }),
    ).toBeInTheDocument();

    await elegirOpcion(
      screen.getByRole('combobox', { name: 'Qué exportar' }),
      'Lecturas de acceso',
    );
    // Con lecturas aparecen los filtros; el resultado cambia y la página bajada ya no sirve para seguir.
    await elegirOpcion(screen.getByRole('combobox', { name: 'Resultado' }), 'Rechazado');
    expect(screen.getByRole('button', { name: 'Descargar CSV' })).toBeInTheDocument();
    expect(screen.queryByText(/descargada:/)).not.toBeInTheDocument();
  });

  it('los filtros de fecha solo aparecen con las lecturas', async () => {
    montar(PERMISO);
    await screen.findByRole('button', { name: 'Descargar CSV' });
    expect(screen.queryByRole('combobox', { name: 'Resultado' })).not.toBeInTheDocument();
    await elegirOpcion(
      screen.getByRole('combobox', { name: 'Qué exportar' }),
      'Lecturas de acceso',
    );
    expect(screen.getByRole('combobox', { name: 'Resultado' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Exportar datos' })).getByText('Desde'),
    ).toBeInTheDocument();
  });
});
