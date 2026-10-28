import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DetalleConsumoPage } from '@/features/limites/ui/pages/DetalleConsumoPage';
import type { LimitesRepositorio } from '@/features/limites/api/LimitesRepositorio';
import { ProveedoresApp } from '@/app/providers/ProveedoresApp';
import { crearServiciosDePrueba, DETALLE_CONSUMO } from '../../../servicios';

function montar(
  consumoDeCuenta: LimitesRepositorio['consumoDeCuenta'] = () => Promise.resolve(DETALLE_CONSUMO),
) {
  const servicios = crearServiciosDePrueba({ limites: { consumoDeCuenta } });
  return render(
    <ProveedoresApp servicios={servicios} reintentos={0}>
      <MemoryRouter initialEntries={['/consumo/cuentas/1']}>
        <Routes>
          <Route path="/consumo/cuentas/:id" element={<DetalleConsumoPage />} />
        </Routes>
      </MemoryRouter>
    </ProveedoresApp>,
  );
}

describe('detalle del consumo de una cuenta', () => {
  it('muestra cuánto lleva del mes, su bolsa y su estado con texto', async () => {
    montar();
    expect(
      await screen.findByRole('heading', { name: 'Agroindustrial Norte' }),
    ).toBeInTheDocument();
    expect(screen.getByText('92')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Aviso')).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: 'Consumo de Agroindustrial Norte' }),
    ).toBeInTheDocument();
  });

  it('la serie diaria tiene su gráfica descrita y su tabla con los mismos datos', async () => {
    montar();
    await screen.findByRole('heading', { name: 'Agroindustrial Norte' });
    expect(
      screen.getByRole('img', { name: 'QR generados por día de Agroindustrial Norte' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver como tabla' }));
    const tabla = screen.getByRole('table', { name: 'QR generados por día' });
    expect(within(tabla).getByText('3/10')).toBeInTheDocument();
    expect(within(tabla).getByText('9')).toBeInTheDocument();
  });

  it('un error se muestra con su código traducido y el botón de reintentar', async () => {
    const { ErrorApi } = await import('../../../servicios');
    montar(() => Promise.reject(new ErrorApi(404, 'cuenta.no_encontrada')));
    expect(await screen.findByText('No encontramos esa cuenta.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
