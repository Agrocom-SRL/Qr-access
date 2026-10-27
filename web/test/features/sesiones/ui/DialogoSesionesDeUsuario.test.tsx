import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProveedoresApp } from '@/app/providers/ProveedoresApp';
import type { SesionesRepositorio } from '@/features/sesiones/api/SesionesRepositorio';
import { DialogoSesionesDeUsuario } from '@/features/sesiones/ui/components/DialogoSesionesDeUsuario';
import {
  ErrorApi,
  SESIONES_DE_USUARIO,
  SUPER_ADMIN,
  crearServiciosDePrueba,
} from '../../../servicios';

const USUARIO = { id: '31', etiqueta: 'Jorge Rivero' };

/** Entra con una sesión restaurada que tiene solo los permisos dados. */
function montar(permisos: readonly string[], sesiones: Partial<SesionesRepositorio> = {}) {
  const servicios = crearServiciosDePrueba({
    seguridad: {
      restaurar: () =>
        Promise.resolve({
          usuario: SUPER_ADMIN.usuario,
          debeCambiarContrasena: false,
          permisos: [...permisos],
        }),
    },
    sesiones,
  });
  servicios.almacen.guardar({ acceso: 'a', refresco: 'r' });
  const onCerrar = vi.fn();
  render(
    <ProveedoresApp servicios={servicios} reintentos={0}>
      <MemoryRouter>
        <DialogoSesionesDeUsuario cuentaId="7" usuario={USUARIO} onCerrar={onCerrar} />
      </MemoryRouter>
    </ProveedoresApp>,
  );
  return { onCerrar };
}

const PERMISOS_COMPLETOS = ['seguridad.sesion_cuenta.ver', 'seguridad.sesion_cuenta.cerrar'];

describe('dispositivos conectados de un usuario (pantalla de AGROCOM)', () => {
  it('muestra cada sesión con su plataforma y su IP, y el nombre del dispositivo como texto', async () => {
    montar(PERMISOS_COMPLETOS);
    const dialogo = await screen.findByRole('dialog', { name: 'Dispositivos conectados' });
    const tabla = within(dialogo).getByRole('table', {
      name: 'Dispositivos conectados de Jorge Rivero',
    });
    expect(within(tabla).getByText('Android')).toBeInTheDocument();
    expect(within(tabla).getByText('190.4.12.9')).toBeInTheDocument();
    expect(within(tabla).getByText('Plataforma desconocida')).toBeInTheDocument();
    expect(within(tabla).getByText('Dispositivo sin nombre')).toBeInTheDocument();
  });

  it('un nombre de dispositivo con HTML se ve literal y no crea ningún elemento', async () => {
    montar(PERMISOS_COMPLETOS);
    const celda = await screen.findByText('Pixel <img src=x onerror=alert(1)>');
    expect(celda.querySelector('img')).toBeNull();
    expect(celda.textContent).toBe('Pixel <img src=x onerror=alert(1)>');
  });

  it('cerrar una sesión pide confirmación antes de llamar a la API', async () => {
    const cerrar = vi.fn(() => Promise.resolve());
    montar(PERMISOS_COMPLETOS, { cerrar });
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Cerrar la sesión de Pixel <img src=x onerror=alert(1)>',
      }),
    );
    const confirmacion = await screen.findByRole('dialog', { name: 'Cerrar esta sesión' });
    expect(cerrar).not.toHaveBeenCalled();
    await userEvent.click(within(confirmacion).getByRole('button', { name: 'Cerrar sesión' }));
    expect(cerrar).toHaveBeenCalledWith('7', '31', SESIONES_DE_USUARIO[0]?.id);
  });

  it('cerrar todas advierte que se anulan los QR vigentes y muestra cuántas se cerraron', async () => {
    const cerrarTodas = vi.fn(() => Promise.resolve(2));
    montar(PERMISOS_COMPLETOS, { cerrarTodas });
    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar todas' }));
    const confirmacion = await screen.findByRole('dialog', { name: 'Cerrar todas las sesiones' });
    expect(within(confirmacion).getByText(/se anulan sus QR vigentes/)).toBeInTheDocument();
    expect(cerrarTodas).not.toHaveBeenCalled();
    await userEvent.click(within(confirmacion).getByRole('button', { name: 'Cerrar todas' }));
    expect(cerrarTodas).toHaveBeenCalledWith('7', '31');
    expect(await screen.findByText('Se cerraron 2 sesiones.')).toBeInTheDocument();
  });

  it('sin el permiso de cerrar, solo se ven las sesiones y ningún botón de cierre', async () => {
    montar(['seguridad.sesion_cuenta.ver']);
    await screen.findByText('Android');
    expect(screen.queryByRole('button', { name: 'Cerrar todas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cerrar la sesión de/ })).not.toBeInTheDocument();
  });

  it('un error de la API se muestra traducido por su código', async () => {
    montar(PERMISOS_COMPLETOS, {
      cerrar: () => Promise.reject(new ErrorApi(404, 'sesion.no_encontrada')),
    });
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Cerrar la sesión de Pixel <img src=x onerror=alert(1)>',
      }),
    );
    const confirmacion = await screen.findByRole('dialog', { name: 'Cerrar esta sesión' });
    await userEvent.click(within(confirmacion).getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByText('Esa sesión ya no está abierta.')).toBeInTheDocument();
  });
});
