import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PestanaConsumo } from '@/features/limites/ui/components/PestanaConsumo';
import type { LimitesRepositorio } from '@/features/limites/api/LimitesRepositorio';
import type { ListadoDeConsumo } from '@/features/limites/domain/consumo';
import { ProveedoresApp } from '@/app/providers/ProveedoresApp';
import { CONSUMO, crearServiciosDePrueba, ErrorApi } from '../../../servicios';

function montar(consumoDeBolsa: LimitesRepositorio['listarConsumo']) {
  const servicios = crearServiciosDePrueba({
    limites: { listarConsumo: consumoDeBolsa },
  });
  return render(
    <ProveedoresApp servicios={servicios} reintentos={0}>
      <MemoryRouter>
        <PestanaConsumo />
      </MemoryRouter>
    </ProveedoresApp>,
  );
}

describe('consumo de la bolsa (pestaña de AGROCOM)', () => {
  it('muestra cada cuenta con su barra accesible y su estado con texto', async () => {
    montar(() => Promise.resolve(CONSUMO));
    // La tabla existe también mientras carga (con esqueletos): se espera a los datos, no a la tabla.
    const barra = await screen.findByRole('progressbar', {
      name: 'Consumo de Frigorífico Oriente',
    });
    const tabla = screen.getByRole('table', { name: 'Consumo de la bolsa por cuenta' });
    expect(barra).toHaveAttribute('aria-valuenow', '100');
    expect(barra).toHaveAttribute('aria-valuetext', expect.stringMatching(/230 de 200 QR/));
    expect(within(tabla).getByText('Superada')).toBeInTheDocument();
    expect(within(tabla).getByText('Aviso')).toBeInTheDocument();
    expect(within(tabla).getByText('Sin tope')).toBeInTheDocument();
  });

  it('una cuenta sin bolsa muestra su cifra, sin barra', async () => {
    montar(() => Promise.resolve(CONSUMO));
    expect(await screen.findByText('12 QR, sin bolsa')).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
  });

  it('el nombre de la cuenta lleva a su consumo de bolsa', async () => {
    montar(() => Promise.resolve(CONSUMO));
    const enlace = await screen.findByRole('link', { name: /Agroindustrial Norte/ });
    expect(enlace).toHaveAttribute('href', '/consumo/cuentas/1');
  });

  it('el filtro de estado manda el estado a la API y muestra el conteo de cada uno', async () => {
    const listar = vi.fn<LimitesRepositorio['listarConsumo']>(() => Promise.resolve(CONSUMO));
    montar(listar);
    await screen.findByRole('table', { name: 'Consumo de la bolsa por cuenta' });
    await userEvent.click(screen.getByRole('button', { name: /^Superada/ }));
    expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ estado: 'superada' }));
  });

  it('la búsqueda espera a que se deje de escribir y viaja recortada', async () => {
    const listar = vi.fn<LimitesRepositorio['listarConsumo']>(() => Promise.resolve(CONSUMO));
    montar(listar);
    await screen.findByRole('table', { name: 'Consumo de la bolsa por cuenta' });
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Buscar por código o nombre' }),
      'FRO',
    );
    await waitFor(() => {
      expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ buscar: 'FRO' }));
    });
  });

  it('sin cuentas que mostrar, dice que todavía no hay consumo', async () => {
    const vacio: ListadoDeConsumo = {
      ...CONSUMO,
      elementos: [],
      total: 0,
      porEstado: { normal: 0, aviso: 0, superada: 0, sin_tope: 0 },
    };
    montar(() => Promise.resolve(vacio));
    expect(
      await screen.findByText('Todavía no hay cuentas con consumo que mostrar.'),
    ).toBeInTheDocument();
  });

  it('un error de la API se traduce por su código y se puede reintentar', async () => {
    const consumoDeBolsa = vi
      .fn<LimitesRepositorio['listarConsumo']>()
      .mockRejectedValueOnce(new ErrorApi(403, 'permiso.denegado'))
      .mockResolvedValue(CONSUMO);
    montar(consumoDeBolsa);
    expect(await screen.findByText('No tienes permiso para hacer esto.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(
      await screen.findByRole('table', { name: 'Consumo de la bolsa por cuenta' }),
    ).toBeInTheDocument();
  });
});
