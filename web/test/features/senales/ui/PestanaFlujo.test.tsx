import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PestanaFlujo } from '@/features/senales/ui/components/PestanaFlujo';
import type { SenalesRepositorio } from '@/features/senales/api/SenalesRepositorio';
import { ProveedoresApp } from '@/app/providers/ProveedoresApp';
import { crearServiciosDePrueba, FLUJO } from '../../../servicios';

/** La tabla se dibuja también con esqueletos mientras carga (`aria-busy`): se espera a que termine. */
async function tablaCargada(nombre: string): Promise<HTMLElement> {
  await waitFor(() => {
    expect(screen.getByRole('table', { name: nombre })).not.toHaveAttribute('aria-busy');
  });
  return screen.getByRole('table', { name: nombre });
}

function montar(listarFlujo: SenalesRepositorio['listarFlujo'] = () => Promise.resolve(FLUJO)) {
  const servicios = crearServiciosDePrueba({ senales: { listarFlujo } });
  return render(
    <ProveedoresApp servicios={servicios} reintentos={0}>
      <MemoryRouter>
        <PestanaFlujo />
      </MemoryRouter>
    </ProveedoresApp>,
  );
}

describe('flujo de cuentas (pestaña de AGROCOM)', () => {
  it('marca el día atípico con texto y compara contra la base habitual', async () => {
    montar();
    const tabla = await tablaCargada('Flujo de cuentas');
    expect(within(tabla).getByText('Atípico')).toBeInTheDocument();
    expect(within(tabla).getByText('Normal')).toBeInTheDocument();
    expect(within(tabla).getByText('12,5')).toBeInTheDocument();
  });

  it('una cuenta sin historia dice "Sin historia" en vez de inventar una base', async () => {
    montar();
    const tabla = await tablaCargada('Flujo de cuentas');
    expect(within(tabla).getByText('Sin historia')).toBeInTheDocument();
  });

  it('las aperturas por usuario salen con un decimal', async () => {
    montar();
    const tabla = await tablaCargada('Flujo de cuentas');
    expect(within(tabla).getByText('0,2')).toBeInTheDocument();
  });

  it('la cuenta enlaza a su flujo detallado', async () => {
    montar();
    const tabla = await tablaCargada('Flujo de cuentas');
    expect(within(tabla).getByRole('link', { name: /Agroindustrial Norte/ })).toHaveAttribute(
      'href',
      '/consumo/flujo/1',
    );
  });

  it('el filtro "con días atípicos" viaja a la API', async () => {
    const listar = vi.fn<SenalesRepositorio['listarFlujo']>(() => Promise.resolve(FLUJO));
    montar(listar);
    await tablaCargada('Flujo de cuentas');
    await userEvent.click(screen.getByRole('button', { name: 'Con días atípicos' }));
    expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ soloAtipicas: true }));
  });
});
