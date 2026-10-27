import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProveedoresApp } from '@/app/providers/ProveedoresApp';
import type { AnulacionRepositorio } from '@/features/anulacion/api/AnulacionRepositorio';
import { PanelAnulacionMasiva } from '@/features/anulacion/ui/components/PanelAnulacionMasiva';
import { ErrorApi, SUPER_ADMIN, crearServiciosDePrueba } from '../../../servicios';

const CUENTA = { id: '7', nombre: 'Agroindustrial Norte', codigo: 'AGR' };

/** Entra con una sesión restaurada que tiene solo los permisos dados y monta el panel. */
function montar(permisos: readonly string[], anulacion: Partial<AnulacionRepositorio> = {}) {
  const restaurar = vi.fn(() =>
    Promise.resolve({
      usuario: SUPER_ADMIN.usuario,
      debeCambiarContrasena: false,
      permisos: [...permisos],
    }),
  );
  const servicios = crearServiciosDePrueba({ seguridad: { restaurar }, anulacion });
  servicios.almacen.guardar({ acceso: 'a', refresco: 'r' });
  render(
    <ProveedoresApp servicios={servicios} reintentos={0}>
      <MemoryRouter>
        <PanelAnulacionMasiva cuenta={CUENTA} />
      </MemoryRouter>
    </ProveedoresApp>,
  );
  return { restaurar };
}

const PERMISO = ['accesos.qr.anular_masivo_cuenta'];

describe('anular los QR de una cuenta (pantalla de AGROCOM)', () => {
  it('sin el permiso, la sección no aparece', async () => {
    const { restaurar } = montar([]);
    await waitFor(() => {
      expect(restaurar).toHaveBeenCalled();
    });
    await act(() => Promise.resolve());
    expect(screen.queryByRole('button', { name: 'Anular QR de la cuenta' })).toBeNull();
  });

  it('el botón solo se habilita con un motivo y el código de la cuenta escritos bien', async () => {
    montar(PERMISO);
    await userEvent.click(await screen.findByRole('button', { name: 'Anular QR de la cuenta' }));
    const dialogo = await screen.findByRole('dialog', {
      name: 'Anular todos los QR de Agroindustrial Norte',
    });
    const confirmar = within(dialogo).getByRole('button', { name: 'Anular todos los QR' });
    expect(confirmar).toBeDisabled();

    await userEvent.type(within(dialogo).getByRole('textbox', { name: 'Motivo' }), 'Uso raro');
    expect(confirmar).toBeDisabled();
    await userEvent.type(within(dialogo).getByRole('textbox', { name: /Escribe AGR/ }), 'AG');
    expect(confirmar).toBeDisabled();
    await userEvent.type(within(dialogo).getByRole('textbox', { name: /Escribe AGR/ }), 'R');
    expect(confirmar).toBeEnabled();
  });

  it('cancelar cierra la confirmación sin llamar a la API', async () => {
    const anularCuenta = vi.fn(() =>
      Promise.resolve({ id: '1', usuariosAlcanzados: 1, qrAnulados: 1 }),
    );
    montar(PERMISO, { anularCuenta });
    await userEvent.click(await screen.findByRole('button', { name: 'Anular QR de la cuenta' }));
    const dialogo = await screen.findByRole('dialog', {
      name: 'Anular todos los QR de Agroindustrial Norte',
    });
    await userEvent.type(within(dialogo).getByRole('textbox', { name: 'Motivo' }), 'Uso raro');
    await userEvent.type(within(dialogo).getByRole('textbox', { name: /Escribe AGR/ }), 'AGR');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(anularCuenta).not.toHaveBeenCalled();
  });

  it('confirmar anula con el motivo y muestra cuántos QR se anularon', async () => {
    const anularCuenta = vi.fn(() =>
      Promise.resolve({ id: '501', usuariosAlcanzados: 3, qrAnulados: 4 }),
    );
    montar(PERMISO, { anularCuenta });
    await userEvent.click(await screen.findByRole('button', { name: 'Anular QR de la cuenta' }));
    const dialogo = await screen.findByRole('dialog', {
      name: 'Anular todos los QR de Agroindustrial Norte',
    });
    await userEvent.type(within(dialogo).getByRole('textbox', { name: 'Motivo' }), '  Robo de QR ');
    await userEvent.type(within(dialogo).getByRole('textbox', { name: /Escribe AGR/ }), 'agr');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Anular todos los QR' }));

    expect(anularCuenta).toHaveBeenCalledWith('7', 'Robo de QR');
    expect(await within(dialogo).findByText('Se anularon 4 QR vigentes.')).toBeInTheDocument();
    // Tras anular, el diálogo ya no ofrece confirmar: solo cerrar.
    expect(
      within(dialogo).queryByRole('button', { name: 'Anular todos los QR' }),
    ).not.toBeInTheDocument();
  });

  it('si no había QR vigentes, lo dice sin fingir que anuló alguno', async () => {
    montar(PERMISO, {
      anularCuenta: () => Promise.resolve({ id: '502', usuariosAlcanzados: 3, qrAnulados: 0 }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Anular QR de la cuenta' }));
    const dialogo = await screen.findByRole('dialog', {
      name: 'Anular todos los QR de Agroindustrial Norte',
    });
    await userEvent.type(within(dialogo).getByRole('textbox', { name: 'Motivo' }), 'Revisión');
    await userEvent.type(within(dialogo).getByRole('textbox', { name: /Escribe AGR/ }), 'AGR');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Anular todos los QR' }));
    expect(
      await within(dialogo).findByText('No había QR vigentes: no se anuló nada.'),
    ).toBeInTheDocument();
  });

  it('un error de la API se muestra traducido por su código y no cierra el diálogo', async () => {
    montar(PERMISO, {
      anularCuenta: () => Promise.reject(new ErrorApi(404, 'cuenta.no_encontrada')),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Anular QR de la cuenta' }));
    const dialogo = await screen.findByRole('dialog', {
      name: 'Anular todos los QR de Agroindustrial Norte',
    });
    await userEvent.type(within(dialogo).getByRole('textbox', { name: 'Motivo' }), 'Revisión');
    await userEvent.type(within(dialogo).getByRole('textbox', { name: /Escribe AGR/ }), 'AGR');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Anular todos los QR' }));
    expect(await within(dialogo).findByText('No encontramos esa cuenta.')).toBeInTheDocument();
    expect(dialogo).toBeInTheDocument();
  });
});
