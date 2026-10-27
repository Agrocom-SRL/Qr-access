import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DialogoSensorDePuerta } from '@/features/placas/ui/components/DialogoSensorDePuerta';
import type { PlacasRepositorio } from '@/features/placas/api/PlacasRepositorio';
import type { Placa } from '@/features/placas/domain/placa';
import { ProveedoresApp } from '@/app/providers/ProveedoresApp';
import { ErrorApi, PLACAS, crearServiciosDePrueba } from '../../../servicios';

const VINCULADA = PLACAS[0] as Placa;

function montar(placas: Partial<PlacasRepositorio>, placa: Placa = VINCULADA) {
  const onCerrar = vi.fn();
  render(
    <ProveedoresApp servicios={crearServiciosDePrueba({ placas })} reintentos={0}>
      <MemoryRouter>
        <DialogoSensorDePuerta placa={placa} onCerrar={onCerrar} />
      </MemoryRouter>
    </ProveedoresApp>,
  );
  return { onCerrar };
}

describe('sensor de la puerta de una placa', () => {
  it('parte de la configuración que ya tiene la placa y avisa que la polaridad se confirma en campo', () => {
    montar({});
    expect(screen.getByRole('switch', { name: 'Hay un sensor de puerta instalado' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Alto' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/La polaridad se confirma en campo/)).toBeInTheDocument();
  });

  it('guarda el sensor instalado y el nivel elegido, y cierra', async () => {
    const configurarSensor = vi.fn<PlacasRepositorio['configurarSensor']>(() => Promise.resolve());
    const { onCerrar } = montar({ configurarSensor });
    await userEvent.click(
      screen.getByRole('switch', { name: 'Hay un sensor de puerta instalado' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Bajo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(configurarSensor).toHaveBeenCalledWith('1', { instalado: false, nivelAbierto: 'bajo' });
    await waitFor(() => {
      expect(onCerrar).toHaveBeenCalled();
    });
  });

  it('un error de la API se traduce y el diálogo queda abierto', async () => {
    const configurarSensor = vi.fn<PlacasRepositorio['configurarSensor']>(() =>
      Promise.reject(new ErrorApi(409, 'placa.sin_dispositivo')),
    );
    const { onCerrar } = montar({ configurarSensor });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(
      await screen.findByText('La placa no está vinculada a ninguna puerta.'),
    ).toBeInTheDocument();
    expect(onCerrar).not.toHaveBeenCalled();
  });
});
