import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ErrorApi, crearServiciosDePrueba } from '../servicios';
import { AppRutas } from '@/app/AppRutas';
import type { Servicios } from '@/app/providers/crearServicios';
import { ProveedoresApp } from '@/app/providers/ProveedoresApp';

function montar(servicios: Servicios, ruta = '/') {
  return render(
    <ProveedoresApp servicios={servicios} reintentos={0}>
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

describe('cuentas (A03)', () => {
  async function irACuentas(servicios: Servicios) {
    montar(servicios, '/ingreso');
    await ingresar();
    await userEvent.click(await screen.findByRole('link', { name: /Cuentas/ }));
  }

  it('lista las cuentas con plan, uso, vencimiento y estado, y los conteos del filtro', async () => {
    await irACuentas(crearServiciosDePrueba());
    const tabla = await screen.findByRole('table', { name: 'Cuentas' });
    expect(within(tabla).getByText('Agroindustrial Norte')).toBeInTheDocument();
    expect(within(tabla).getByText('87 / 100')).toBeInTheDocument();
    expect(within(tabla).getByText('05/11/2026')).toBeInTheDocument();
    expect(within(tabla).getByText('Por vencer')).toBeInTheDocument();
    expect(screen.getByText('42 empresas cliente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Por vencer/ })).toHaveTextContent('5');
  });

  it('filtrar por estado y buscar mandan los filtros al repositorio', async () => {
    const listar = vi.fn(() =>
      Promise.resolve({
        elementos: [],
        pagina: 1,
        porPagina: 10,
        total: 0,
        conteos: { todas: 0, activa: 0, porVencer: 0, vencida: 0, suspendida: 0 },
      }),
    );
    await irACuentas(crearServiciosDePrueba({ cuentas: { listar } }));
    await userEvent.click(await screen.findByRole('button', { name: /Vencidas/ }));
    await waitFor(() => {
      expect(listar).toHaveBeenLastCalledWith(
        expect.objectContaining({ estado: 'vencida', pagina: 1 }),
      );
    });
    await userEvent.type(screen.getByRole('searchbox'), 'fri');
    await waitFor(() => {
      expect(listar).toHaveBeenLastCalledWith(
        expect.objectContaining({ busqueda: 'fri', estado: 'vencida' }),
      );
    });
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
  });

  it('sin cuentas: estado vacío con la acción de crear', async () => {
    await irACuentas(
      crearServiciosDePrueba({
        cuentas: {
          listar: () =>
            Promise.resolve({
              elementos: [],
              pagina: 1,
              porPagina: 10,
              total: 0,
              conteos: { todas: 0, activa: 0, porVencer: 0, vencida: 0, suspendida: 0 },
            }),
        },
      }),
    );
    expect(await screen.findByText('Aún no hay cuentas')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Crear cuenta' })).toHaveLength(2);
  });

  it('error de carga con reintento', async () => {
    await irACuentas(
      crearServiciosDePrueba({
        cuentas: { listar: () => Promise.reject(new ErrorApi(500, 'interno')) },
      }),
    );
    expect(await screen.findByText('No pudimos cargar las cuentas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});

describe('crear cuenta (A04)', () => {
  async function llenarEmpresa(codigo = 'AGU') {
    await userEvent.click(await screen.findByRole('button', { name: 'Crear cuenta' }));
    await userEvent.type(await screen.findByLabelText('Razón social'), 'Agrícola Guarayos S.A.');
    await userEvent.type(screen.getByLabelText('NIT'), '2876501019');
    await userEvent.selectOptions(screen.getByLabelText('Ciudad'), 'Ascensión de Guarayos');
    await userEvent.type(screen.getByLabelText(/Código de cuenta/), codigo);
    await userEvent.type(screen.getByLabelText('Contacto de facturación'), 'Rodrigo Añez');
    await userEvent.type(screen.getByLabelText('Teléfono'), '7 712 4405');
  }

  async function empezar(servicios: Servicios) {
    montar(servicios, '/ingreso');
    await ingresar();
    await userEvent.click(await screen.findByRole('link', { name: /Cuentas/ }));
  }

  it('un código ocupado dice de quién es, ofrece sugerencias y bloquea continuar', async () => {
    await empezar(crearServiciosDePrueba());
    await llenarEmpresa('AGR');
    expect(await screen.findByText('Ese código ya es de Agroindustrial Norte')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'GUA' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByRole('heading', { name: 'Crea una cuenta' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'GUA' }));
    expect(await screen.findByText('Disponible')).toBeInTheDocument();
  });

  it('recorre los cuatro pasos, crea la cuenta y muestra el PIN una sola vez', async () => {
    const crear = vi.fn(
      (borrador: {
        empresa: { codigo: string; razonSocial: string };
        vigencia: { administradorNombre: string };
      }) =>
        Promise.resolve({
          cuenta: {
            id: '77',
            codigo: borrador.empresa.codigo,
            nombre: borrador.empresa.razonSocial,
          },
          administrador: {
            id: '88',
            etiqueta: borrador.vigencia.administradorNombre,
            pin: 'AGU9F4M',
          },
        }),
    );
    await empezar(crearServiciosDePrueba({ cuentas: { crear } }));
    await llenarEmpresa();
    await screen.findByText('Disponible');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByRole('heading', { name: 'Elige el plan' })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('radio', { name: /200 usuarios/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    await userEvent.type(await screen.findByLabelText('Nombre o etiqueta'), 'Rodrigo Añez');
    expect(screen.getByLabelText('Vence')).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByRole('heading', { name: 'Revisa y confirma' })).toBeInTheDocument();
    expect(screen.getByText('AGU · 2876501019')).toBeInTheDocument();
    expect(screen.getByText('Bs 21.600')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('heading', { name: 'Cuenta creada' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'A G U 9 F 4 M' })).toBeInTheDocument();
    expect(screen.getByText(/Este PIN no se vuelve a mostrar/)).toBeInTheDocument();
    expect(crear).toHaveBeenCalledOnce();
    expect(crear.mock.calls[0]?.[0]).toMatchObject({ planId: '2' });
  });

  it('el PIN no queda en la caché de consultas ni en el almacenamiento', async () => {
    await empezar(crearServiciosDePrueba());
    await llenarEmpresa();
    await screen.findByText('Disponible');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await userEvent.click(await screen.findByRole('radio', { name: /100 usuarios/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await userEvent.type(await screen.findByLabelText('Nombre o etiqueta'), 'Rodrigo');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Crear cuenta' }));
    await screen.findByRole('heading', { name: 'Cuenta creada' });
    expect(JSON.stringify(Object.entries(localStorage))).not.toContain('AGU9F4M');
    expect(JSON.stringify(Object.entries(sessionStorage))).not.toContain('AGU9F4M');
  });

  it('un error de la API al crear se traduce y deja reintentar', async () => {
    const crear = vi.fn(() =>
      Promise.reject(new ErrorApi(409, 'cuenta.codigo_existente', { cuenta: 'Otra' })),
    );
    await empezar(crearServiciosDePrueba({ cuentas: { crear } }));
    await llenarEmpresa();
    await screen.findByText('Disponible');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await userEvent.click(await screen.findByRole('radio', { name: /100 usuarios/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await userEvent.type(await screen.findByLabelText('Nombre o etiqueta'), 'Rodrigo');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByText('Ese código ya es de otra cuenta.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeEnabled();
  });
});

describe('detalle de cuenta (A05)', () => {
  async function abrirDetalle(servicios: Servicios) {
    montar(servicios, '/ingreso');
    await ingresar();
    await userEvent.click(await screen.findByRole('link', { name: /Cuentas/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Ver Agroindustrial Norte' }));
  }

  it('muestra el plan, el uso, la empresa y los indicadores', async () => {
    await abrirDetalle(crearServiciosDePrueba());
    expect(
      await screen.findByRole('heading', { name: /Agroindustrial Norte/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Hasta 100 usuarios')).toBeInTheDocument();
    expect(screen.getByText('87 / 100')).toBeInTheDocument();
    expect(screen.getByText('Puede crear 13 usuarios más')).toBeInTheDocument();
    expect(screen.getByText(/Vence el 05\/11\/2026, en 24 días/)).toBeInTheDocument();
    expect(screen.getByText('Carla Méndez')).toBeInTheDocument();
    expect(screen.getByText('2 · 5')).toBeInTheDocument();
  });

  it('la pestaña Sitios y puertas muestra el estado de cada lector', async () => {
    await abrirDetalle(crearServiciosDePrueba());
    await userEvent.click(await screen.findByRole('tab', { name: 'Sitios y puertas' }));
    expect(await screen.findByText('Planta Warnes')).toBeInTheDocument();
    expect(screen.getByText('En línea')).toBeInTheDocument();
    expect(screen.getByText('Sin conexión')).toBeInTheDocument();
    expect(screen.getByText(/Aquí solo se consultan/)).toBeInTheDocument();
  });

  it('una cuenta inexistente muestra "No encontramos esa cuenta"', async () => {
    await abrirDetalle(
      crearServiciosDePrueba({
        cuentas: { obtener: () => Promise.reject(new ErrorApi(404, 'cuenta.no_encontrada')) },
      }),
    );
    expect(await screen.findByText('No encontramos esa cuenta')).toBeInTheDocument();
  });
});
