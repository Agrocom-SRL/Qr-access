import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ErrorApi, crearServiciosDePrueba } from '../servicios';
import { AppRutas } from '@/app/AppRutas';
import type { Servicios } from '@/app/providers/crearServicios';
import { ProveedoresApp } from '@/app/providers/ProveedoresApp';

function montar(servicios: Servicios, ruta = '/') {
  return render(
    <ProveedoresApp servicios={servicios}>
      <MemoryRouter initialEntries={[ruta]}>
        <AppRutas />
      </MemoryRouter>
    </ProveedoresApp>,
  );
}

async function ingresar(usuario = 'lucia.paz', contrasena = 'secreta-12345') {
  await userEvent.type(screen.getByLabelText('Usuario'), usuario);
  await userEvent.type(screen.getByLabelText('Contraseña'), contrasena);
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
}

describe('ingreso (A01)', () => {
  it('sin sesión, cualquier ruta lleva al ingreso', async () => {
    montar(crearServiciosDePrueba(), '/cuentas');
    expect(await screen.findByRole('heading', { name: 'Ingresa al panel' })).toBeInTheDocument();
  });

  it('con credenciales válidas entra al panel y muestra el rail con el usuario', async () => {
    montar(crearServiciosDePrueba(), '/ingreso');
    await ingresar();
    expect(await screen.findByRole('navigation', { name: 'AGROCOM Acceso' })).toBeInTheDocument();
    expect(screen.getAllByText('Lucía Paz').length).toBeGreaterThan(0);
  });

  it('credenciales incorrectas: mensaje traducido y campos marcados', async () => {
    const servicios = crearServiciosDePrueba({
      seguridad: {
        ingresar: () => Promise.reject(new ErrorApi(401, 'sesion.credenciales_invalidas')),
      },
    });
    montar(servicios, '/ingreso');
    await ingresar();
    expect(await screen.findByText('Credenciales incorrectas')).toBeInTheDocument();
    expect(screen.getByLabelText('Usuario')).toHaveAttribute('aria-invalid', 'true');
  });

  it('bloqueo temporal: deshabilita el botón con la cuenta regresiva', async () => {
    const servicios = crearServiciosDePrueba({
      seguridad: {
        ingresar: () =>
          Promise.reject(new ErrorApi(429, 'sesion.bloqueada', { reintentar_en_segundos: 272 })),
      },
    });
    montar(servicios, '/ingreso');
    await ingresar();
    const boton = await screen.findByRole('button', {
      name: /Ingresar en 04:3\d|Ingresar en 04:2\d/,
    });
    expect(boton).toBeDisabled();
  });

  it('con contraseña temporal solo deja entrar a Perfil', async () => {
    const servicios = crearServiciosDePrueba({
      seguridad: {
        ingresar: () =>
          Promise.resolve({
            usuario: { id: '5', nombre: 'Nueva', usuario: 'nueva' },
            debeCambiarContrasena: true,
            permisos: [],
          }),
      },
    });
    montar(servicios, '/ingreso');
    await ingresar('nueva', 'temporal-1234');
    expect(await screen.findByRole('heading', { name: 'Perfil' })).toBeInTheDocument();
    expect(screen.getByText(/Tu contraseña es temporal/)).toBeInTheDocument();
  });
});

describe('perfil (A12)', () => {
  it('cambia la contraseña validando con las reglas del dominio', async () => {
    const cambiarContrasena = vi.fn(() => Promise.resolve());
    const servicios = crearServiciosDePrueba({ seguridad: { cambiarContrasena } });
    montar(servicios, '/ingreso');
    await ingresar();
    await userEvent.click(await screen.findByRole('link', { name: /Lucía Paz/ }));
    await userEvent.type(await screen.findByLabelText('Actual'), 'secreta-12345');
    await userEvent.type(screen.getByLabelText('Nueva'), 'corta');
    await userEvent.type(screen.getByLabelText('Repite la nueva'), 'corta');
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
    expect(await screen.findByText('Usa al menos 10 caracteres')).toBeInTheDocument();
    expect(cambiarContrasena).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText('Nueva'));
    await userEvent.clear(screen.getByLabelText('Repite la nueva'));
    await userEvent.type(screen.getByLabelText('Nueva'), 'una-nueva-1234');
    await userEvent.type(screen.getByLabelText('Repite la nueva'), 'una-nueva-1234');
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
    await waitFor(() => {
      expect(cambiarContrasena).toHaveBeenCalledWith('secreta-12345', 'una-nueva-1234');
    });
  });

  it('cerrar sesión devuelve al ingreso', async () => {
    montar(crearServiciosDePrueba(), '/ingreso');
    await ingresar();
    await userEvent.click(await screen.findByRole('link', { name: /Lucía Paz/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('heading', { name: 'Ingresa al panel' })).toBeInTheDocument();
  });
});

describe('equipo (A11)', () => {
  async function irAEquipo(servicios: Servicios) {
    montar(servicios, '/ingreso');
    await ingresar();
    await userEvent.click(await screen.findByRole('link', { name: /Equipo AGROCOM/ }));
  }

  it('lista al equipo: "Tú" sin acción y desactivar solo en otra persona activa', async () => {
    await irAEquipo(crearServiciosDePrueba());
    const tabla = await screen.findByRole('table', { name: 'Equipo AGROCOM' });
    expect(within(tabla).getByText('Tú')).toBeInTheDocument();
    expect(within(tabla).getAllByRole('button', { name: 'Desactivar' })).toHaveLength(1);
    expect(within(tabla).getByText('Desactivado')).toBeInTheDocument();
    expect(screen.getByText('Quienes administran la plataforma · 2 activos')).toBeInTheDocument();
  });

  it('desactivar pide confirmación', async () => {
    const desactivar = vi.fn(() => Promise.resolve());
    await irAEquipo(crearServiciosDePrueba({ equipo: { desactivar } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar' }));
    expect(desactivar).not.toHaveBeenCalled();
    const dialogo = await screen.findByText('¿Desactivar a Marco Suárez?');
    expect(dialogo).toBeInTheDocument();
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Desactivar' }).at(-1) as HTMLElement,
    );
    await waitFor(() => {
      expect(desactivar).toHaveBeenCalledWith('2');
    });
  });

  it('error de carga: título, código traducido y reintentar', async () => {
    await irAEquipo(
      crearServiciosDePrueba({
        equipo: { listar: () => Promise.reject(new ErrorApi(403, 'permiso.denegado')) },
      }),
    );
    expect(await screen.findByText('No pudimos cargar el equipo')).toBeInTheDocument();
    expect(screen.getByText('No tienes permiso para hacer esto.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('agregar: genera la contraseña, valida el usuario y envía', async () => {
    const agregar = vi.fn(
      (nuevo: { nombre: string; usuario: string; contrasenaTemporal: string }) =>
        Promise.resolve({
          id: '9',
          nombre: nuevo.nombre,
          usuario: nuevo.usuario,
          activo: true,
          esActual: false,
          ultimoIngresoEn: null,
        }),
    );
    await irAEquipo(crearServiciosDePrueba({ equipo: { agregar } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar super admin' }));
    await userEvent.type(await screen.findByLabelText('Nombre completo'), 'Valeria Justiniano');
    expect(screen.getByLabelText('Usuario', { selector: 'input' })).toHaveValue(
      'valeria.justiniano',
    );
    expect(await screen.findByText('Disponible')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    await waitFor(() => {
      expect(agregar).toHaveBeenCalledOnce();
    });
    const enviado = agregar.mock.calls[0]?.[0];
    expect(enviado?.usuario).toBe('valeria.justiniano');
    expect(enviado?.contrasenaTemporal).toMatch(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/);
  });
});

describe('planes (A09)', () => {
  async function irAPlanes(servicios: Servicios) {
    montar(servicios, '/ingreso');
    await ingresar();
    await userEvent.click(await screen.findByRole('link', { name: /Planes/ }));
  }

  it('muestra los tres planes con su precio, cuentas y usuarios en uso', async () => {
    await irAPlanes(crearServiciosDePrueba());
    expect(await screen.findByText('100 usuarios')).toBeInTheDocument();
    expect(screen.getByLabelText('Editar precio de 200 usuarios')).toHaveValue('21.600');
    expect(screen.getByText('1.604')).toBeInTheDocument();
    expect(screen.getAllByText('QR ilimitados')).toHaveLength(3);
  });

  it('guardar manda solo los precios que cambiaron', async () => {
    const guardarPrecios = vi.fn(() => Promise.resolve());
    await irAPlanes(crearServiciosDePrueba({ planes: { guardarPrecios } }));
    const guardar = await screen.findByRole('button', { name: 'Guardar precios' });
    expect(guardar).toBeDisabled();
    const campo = screen.getByLabelText('Editar precio de 100 usuarios');
    await userEvent.clear(campo);
    await userEvent.type(campo, '13000');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar precios' }));
    await waitFor(() => {
      expect(guardarPrecios).toHaveBeenCalledWith([{ planId: '1', precioAnual: 13000 }]);
    });
  });

  it('un monto inválido marca el campo y no habilita guardar', async () => {
    await irAPlanes(crearServiciosDePrueba());
    const campo = await screen.findByLabelText('Editar precio de 100 usuarios');
    await userEvent.clear(campo);
    await userEvent.type(campo, '12,5');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Guardar precios' })).toBeDisabled();
  });

  it('descartar vuelve a los precios vigentes', async () => {
    await irAPlanes(crearServiciosDePrueba());
    const campo = await screen.findByLabelText('Editar precio de 100 usuarios');
    await userEvent.clear(campo);
    await userEvent.type(campo, '15000');
    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    await userEvent.tab();
    expect(screen.getByLabelText('Editar precio de 100 usuarios')).toHaveValue('12.000');
  });
});
