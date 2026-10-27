import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DetalleFlujoPage } from '@/features/senales/ui/pages/DetalleFlujoPage';
import type { SenalesRepositorio } from '@/features/senales/api/SenalesRepositorio';
import { ProveedoresApp } from '@/app/providers/ProveedoresApp';
import { crearServiciosDePrueba, DETALLE_FLUJO } from '../../../servicios';

function montar(
  ruta: string,
  flujoDeCuenta: SenalesRepositorio['flujoDeCuenta'] = () => Promise.resolve(DETALLE_FLUJO),
) {
  const servicios = crearServiciosDePrueba({ senales: { flujoDeCuenta } });
  return render(
    <ProveedoresApp servicios={servicios} reintentos={0}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/consumo/flujo/:id" element={<DetalleFlujoPage />} />
        </Routes>
      </MemoryRouter>
    </ProveedoresApp>,
  );
}

describe('flujo de una cuenta, día por día', () => {
  it('cuenta los días atípicos del periodo y marca el de hoy', async () => {
    montar('/consumo/flujo/1?dias=30');
    expect(
      await screen.findByRole('heading', { name: 'Flujo de Agroindustrial Norte' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Días atípicos en el periodo').nextElementSibling).toBeNull();
    expect(screen.getByText('Atípico', { selector: 'span' })).toBeInTheDocument();
  });

  it('pide el periodo de la URL y lo cambia desde el selector', async () => {
    const flujo = vi.fn<SenalesRepositorio['flujoDeCuenta']>(() => Promise.resolve(DETALLE_FLUJO));
    montar('/consumo/flujo/1?dias=30', flujo);
    await screen.findByRole('heading', { name: 'Flujo de Agroindustrial Norte' });
    expect(flujo).toHaveBeenLastCalledWith('1', 30);
    await userEvent.click(screen.getByRole('button', { name: '7 días' }));
    expect(flujo).toHaveBeenLastCalledWith('1', 7);
  });

  it('la gráfica tiene su tabla alternativa con las mismas marcas', async () => {
    montar('/consumo/flujo/1');
    await screen.findByRole('heading', { name: 'Flujo de Agroindustrial Norte' });
    expect(
      screen.getByRole('img', {
        name: 'Aperturas por día de Agroindustrial Norte; 1 días atípicos',
      }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver como tabla' }));
    const tabla = screen.getByRole('table', { name: 'Aperturas por día' });
    expect(within(tabla).getByText('27/10')).toBeInTheDocument();
    expect(within(tabla).getByText('Atípico')).toBeInTheDocument();
  });
});
