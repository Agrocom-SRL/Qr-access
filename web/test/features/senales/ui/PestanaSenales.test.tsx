import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PestanaSenales } from '@/features/senales/ui/components/PestanaSenales';
import type { SenalesRepositorio } from '@/features/senales/api/SenalesRepositorio';
import { ProveedoresApp } from '@/app/providers/ProveedoresApp';
import { crearServiciosDePrueba, SENALES_DE_ABUSO } from '../../../servicios';

/** La tabla se dibuja también con esqueletos mientras carga (`aria-busy`): se espera a que termine. */
async function tablaCargada(nombre: string): Promise<HTMLElement> {
  await waitFor(() => {
    expect(screen.getByRole('table', { name: nombre })).not.toHaveAttribute('aria-busy');
  });
  return screen.getByRole('table', { name: nombre });
}

function montar(
  listarSenales: SenalesRepositorio['listarSenales'] = () =>
    Promise.resolve({ elementos: SENALES_DE_ABUSO, pagina: 1, porPagina: 20, total: 2 }),
) {
  const servicios = crearServiciosDePrueba({ senales: { listarSenales } });
  return render(
    <ProveedoresApp servicios={servicios} reintentos={0}>
      <MemoryRouter>
        <PestanaSenales />
      </MemoryRouter>
    </ProveedoresApp>,
  );
}

describe('señales de abuso (pestaña de AGROCOM)', () => {
  it('traduce el código de la descripción a una frase con sus números, nunca lo muestra crudo', async () => {
    montar();
    expect(await screen.findByText('13 aperturas en el día; el umbral es 12.')).toBeInTheDocument();
    expect(
      screen.getByText('5 rechazos de 2 QR en 3 lectores; el mínimo es 3.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/aperturas=13/)).not.toBeInTheDocument();
    expect(screen.queryByText(/qrs=2/)).not.toBeInTheDocument();
  });

  it('la gravedad y el estado se leen con texto, además del color', async () => {
    montar();
    const tabla = await tablaCargada('Señales de abuso');
    expect(within(tabla).getByText('Media')).toBeInTheDocument();
    expect(within(tabla).getByText('Alta')).toBeInTheDocument();
    expect(within(tabla).getByText('Sin resolver')).toBeInTheDocument();
    expect(within(tabla).getByText('Pendiente')).toBeInTheDocument();
  });

  it('una señal sin etiqueta de usuario dice "Sin nombre" y deja su id', async () => {
    montar();
    const tabla = await tablaCargada('Señales de abuso');
    expect(within(tabla).getByText('Sin nombre')).toBeInTheDocument();
    expect(within(tabla).getByText('#41')).toBeInTheDocument();
  });

  it('la cuenta enlaza a su detalle', async () => {
    montar();
    const tabla = await tablaCargada('Señales de abuso');
    expect(within(tabla).getByRole('link', { name: /Agroindustrial Norte/ })).toHaveAttribute(
      'href',
      '/cuentas/1',
    );
  });

  it('por omisión pide las abiertas; el filtro de gravedad viaja a la API', async () => {
    const listar = vi.fn<SenalesRepositorio['listarSenales']>(() =>
      Promise.resolve({ elementos: SENALES_DE_ABUSO, pagina: 1, porPagina: 20, total: 2 }),
    );
    montar(listar);
    await tablaCargada('Señales de abuso');
    expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ estado: 'abiertas' }));
    await userEvent.click(screen.getByRole('button', { name: 'Alta' }));
    expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ gravedad: 'alta' }));
  });

  it('el filtro de tipo se elige en la lista y viaja a la API', async () => {
    const listar = vi.fn<SenalesRepositorio['listarSenales']>(() =>
      Promise.resolve({ elementos: [], pagina: 1, porPagina: 20, total: 0 }),
    );
    montar(listar);
    await screen.findByText('Cuando el sistema detecte un uso raro, aparece aquí.');
    await userEvent.click(screen.getByLabelText('Tipo'));
    await userEvent.click(screen.getByRole('option', { name: 'Uso imposible' }));
    expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ tipo: 'uso_imposible' }));
  });

  it('sin señales, dice que el sistema las mostrará aquí', async () => {
    montar(() => Promise.resolve({ elementos: [], pagina: 1, porPagina: 20, total: 0 }));
    expect(
      await screen.findByText('Cuando el sistema detecte un uso raro, aparece aquí.'),
    ).toBeInTheDocument();
  });

  it('el resumen muestra el total y las cuentas con más señales', async () => {
    montar();
    expect(await screen.findByText('Señales por tipo')).toBeInTheDocument();
    expect(
      await screen.findByText('Últimos 7 días: 7 señales, 5 sin resolver'),
    ).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Cuentas con más señales' })).toBeInTheDocument();
  });

  it('un error al listar se traduce por su código y se puede reintentar', async () => {
    const { ErrorApi } = await import('../../../servicios');
    const listar = vi
      .fn<SenalesRepositorio['listarSenales']>()
      .mockRejectedValueOnce(new ErrorApi(500, 'desconocido'))
      .mockResolvedValue({ elementos: SENALES_DE_ABUSO, pagina: 1, porPagina: 20, total: 2 });
    montar(listar);
    expect(
      await screen.findByText('Algo falló de nuestro lado. Intenta de nuevo en unos segundos.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('13 aperturas en el día; el umbral es 12.')).toBeInTheDocument();
  });
});
