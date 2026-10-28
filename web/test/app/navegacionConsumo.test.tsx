import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRutas } from '@/app/AppRutas';
import { ProveedoresApp } from '@/app/providers/ProveedoresApp';
import { crearServiciosDePrueba } from '../servicios';

/** Entra con una sesión restaurada que tiene solo los permisos dados. */
function montar(permisos: string[]) {
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
  servicios.almacen.guardar({ acceso: 'a', refresco: 'r' });
  return render(
    <ProveedoresApp servicios={servicios} reintentos={0}>
      <MemoryRouter initialEntries={['/']}>
        <AppRutas />
      </MemoryRouter>
    </ProveedoresApp>,
  );
}

describe('navegación de consumo y señales', () => {
  it('el ítem "Consumo" aparece con cualquiera de sus dos permisos', async () => {
    montar(['seguridad.senal.ver']);
    expect(await screen.findByRole('link', { name: 'Consumo' })).toHaveAttribute(
      'href',
      '/consumo',
    );
  });

  it('sin ninguno de los dos permisos, el ítem no aparece', async () => {
    montar(['resumen.panel.ver']);
    await screen.findByRole('navigation', { name: 'AGROCOM Acceso' });
    expect(screen.queryByRole('link', { name: 'Consumo' })).not.toBeInTheDocument();
  });
});
