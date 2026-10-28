import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProveedoresApp } from '@/app/providers/ProveedoresApp';
import { DetalleCuentaPage } from '@/features/cuentas/ui/pages/DetalleCuentaPage';
import { SUPER_ADMIN, crearServiciosDePrueba } from '../../../servicios';

/** Monta la ficha de la cuenta 7 en la pestaña de operaciones, con una sesión de los permisos dados. */
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
  servicios.almacen.guardar('a');
  render(
    <ProveedoresApp servicios={servicios} reintentos={0}>
      <MemoryRouter initialEntries={['/cuentas/7?pestana=operaciones']}>
        <Routes>
          <Route path="/cuentas/:id" element={<DetalleCuentaPage />} />
        </Routes>
      </MemoryRouter>
    </ProveedoresApp>,
  );
}

describe('ficha de cuenta: pestaña "QR y datos"', () => {
  it('sin ninguno de sus permisos, la pestaña no aparece', async () => {
    montar(['seguridad.cuenta.ver']);
    expect(
      await screen.findByRole('tablist', { name: 'Secciones de la cuenta' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'QR y datos' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Exportar datos' })).toBeNull();
  });

  it('con el permiso de exportar, muestra la exportación y no la anulación', async () => {
    montar(['accesos.evento.exportar_cuenta']);
    expect(await screen.findByRole('tab', { name: 'QR y datos' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await screen.findByRole('heading', { name: 'Exportar datos' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Anular QR de la cuenta' })).toBeNull();
  });

  it('con el permiso de anular, muestra la anulación y no la exportación', async () => {
    montar(['accesos.qr.anular_masivo_cuenta']);
    expect(
      await screen.findByRole('button', { name: 'Anular QR de la cuenta' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Exportar datos' })).toBeNull();
  });
});
