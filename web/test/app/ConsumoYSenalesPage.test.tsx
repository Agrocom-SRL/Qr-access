import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ConsumoYSenalesPage } from '@/app/ConsumoYSenalesPage';
import { ProveedoresApp } from '@/app/providers/ProveedoresApp';
import { crearServiciosDePrueba } from '../servicios';

/** Una sesión restaurada con solo los permisos dados, como la deja el ingreso de la API. */
function montar(permisos: string[], ruta = '/consumo') {
  const servicios = crearServiciosDePrueba({
    seguridad: {
      restaurar: () =>
        Promise.resolve({
          usuario: { id: '1', nombre: 'Lucía Paz', usuario: 'lucia.paz' },
          debeCambiarContrasena: false,
          permisos,
        }),
    },
  });
  // La sesión restaurada deja su acceso en memoria; el servicio la devuelve al arrancar.
  servicios.almacen.guardar('a');
  return render(
    <ProveedoresApp servicios={servicios} reintentos={0}>
      <MemoryRouter initialEntries={[ruta]}>
        <ConsumoYSenalesPage />
      </MemoryRouter>
    </ProveedoresApp>,
  );
}

describe('consumo y señales: cada sección con su permiso', () => {
  it('con el permiso de consumo, solo aparece la pestaña de consumo', async () => {
    montar(['limites.consumo.ver']);
    expect(await screen.findByRole('tab', { name: 'Consumo de bolsa' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Señales' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Flujo' })).not.toBeInTheDocument();
  });

  it('con el permiso de señales, aparecen señales y flujo, y la primera es la activa', async () => {
    montar(['seguridad.senal.ver']);
    expect(await screen.findByRole('tab', { name: 'Señales' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Flujo' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Consumo de bolsa' })).not.toBeInTheDocument();
  });

  it('la pestaña va en la URL y se puede cambiar', async () => {
    montar(['limites.consumo.ver', 'seguridad.senal.ver'], '/consumo?pestana=flujo');
    expect(await screen.findByRole('tab', { name: 'Flujo' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Consumo de bolsa' }));
    expect(screen.getByRole('tab', { name: 'Consumo de bolsa' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('sin ninguno de los dos permisos, dice que no hay acceso y no pide datos', async () => {
    montar(['resumen.panel.ver']);
    expect(await screen.findByText('No tienes acceso a esta sección')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });
});
