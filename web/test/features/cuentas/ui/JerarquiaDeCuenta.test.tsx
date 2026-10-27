import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProveedoresApp } from '@/app/providers/ProveedoresApp';
import { JerarquiaDeCuenta } from '@/features/cuentas/ui/components/JerarquiaDeCuenta';
import { SUPER_ADMIN, crearServiciosDePrueba } from '../../../servicios';

/** Entra con una sesión restaurada que tiene solo los permisos dados. */
function montar(permisos: readonly string[]) {
  const servicios = crearServiciosDePrueba({
    seguridad: {
      restaurar: () =>
        Promise.resolve({
          usuario: SUPER_ADMIN.usuario,
          debeCambiarContrasena: false,
          permisos: [...permisos],
        }),
    },
  });
  servicios.almacen.guardar({ acceso: 'a', refresco: 'r' });
  return render(
    <ProveedoresApp servicios={servicios} reintentos={0}>
      <MemoryRouter>
        <JerarquiaDeCuenta cuentaId="7" puedeReasignar={false} />
      </MemoryRouter>
    </ProveedoresApp>,
  );
}

describe('jerarquía de la cuenta: dispositivos de cada persona', () => {
  it('con el permiso de ver sesiones, cada persona abre sus dispositivos conectados', async () => {
    montar(['seguridad.sesion_cuenta.ver']);
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Ver los dispositivos conectados de Jorge Rivero',
      }),
    );
    const dialogo = await screen.findByRole('dialog', { name: 'Dispositivos conectados' });
    expect(
      within(dialogo).getByRole('table', { name: 'Dispositivos conectados de Jorge Rivero' }),
    ).toBeInTheDocument();
  });

  it('el Administrador también tiene su botón de dispositivos', async () => {
    montar(['seguridad.sesion_cuenta.ver']);
    expect(
      await screen.findByRole('button', {
        name: 'Ver los dispositivos conectados de Carla Méndez',
      }),
    ).toBeInTheDocument();
  });

  it('sin el permiso de ver sesiones, no aparece ningún botón de dispositivos', async () => {
    montar(['seguridad.administrador.reasignar']);
    await screen.findByText('Jorge Rivero');
    expect(
      screen.queryByRole('button', { name: /Ver los dispositivos conectados/ }),
    ).not.toBeInTheDocument();
  });
});
