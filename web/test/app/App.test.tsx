import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { COBRANZA, ErrorApi, EVENTOS, SUSCRIPCION, crearServiciosDePrueba } from '../servicios';
import type { PlacasRepositorio } from '@/features/placas';
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
    await userEvent.click(await screen.findByRole('button', { name: /Cambiar contraseña/ }));
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

  it('lista los ajustes como filas y cada una abre su modal; el nombre se cambia ahí', async () => {
    const cambiarNombre = vi.fn(() => Promise.resolve());
    montar(crearServiciosDePrueba({ seguridad: { cambiarNombre } }), '/ingreso');
    await ingresar();
    await userEvent.click(await screen.findByRole('link', { name: /Lucía Paz/ }));
    const tema = await screen.findByRole('button', { name: /Tema/ });
    const contrasena = screen.getByRole('button', { name: /Cambiar contraseña/ });
    expect(screen.getByRole('button', { name: /Idioma/ })).toBeInTheDocument();
    expect(
      tema.compareDocumentPosition(contrasena) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: /^Nombre/ }));
    const campo = screen.getByLabelText('Nombre');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'Lucía Paz Rojas');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }));
    await waitFor(() => {
      expect(cambiarNombre).toHaveBeenCalledWith('Lucía Paz Rojas');
    });
  });

  it('el tema se elige en un modal de opciones', async () => {
    montar(crearServiciosDePrueba(), '/ingreso');
    await ingresar();
    await userEvent.click(await screen.findByRole('link', { name: /Lucía Paz/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Tema/ }));
    await userEvent.click(await screen.findByRole('radio', { name: 'Oscuro' }));
    expect(document.documentElement.dataset.tema).toBe('oscuro');
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
    await userEvent.click(await screen.findByRole('link', { name: /Usuarios/ }));
  }

  it('lista al equipo: "Tú" sin acción y desactivar solo en otra persona activa', async () => {
    await irAEquipo(crearServiciosDePrueba());
    const tabla = await screen.findByRole('table', { name: 'Administradores de AGROCOM' });
    expect(within(tabla).getByText('Tú')).toBeInTheDocument();
    expect(within(tabla).getAllByRole('button', { name: /^Desactivar a / })).toHaveLength(1);
    expect(within(tabla).getAllByRole('button', { name: /^Editar a / }).length).toBeGreaterThan(1);
    expect(within(tabla).getByRole('button', { name: /^Reactivar a / })).toBeInTheDocument();
    expect(within(tabla).getByText('Desactivado')).toBeInTheDocument();
    expect(screen.getByText('Quienes administran la plataforma · 2 activos')).toBeInTheDocument();
  });

  it('desactivar pide confirmación', async () => {
    const desactivar = vi.fn(() => Promise.resolve());
    await irAEquipo(crearServiciosDePrueba({ equipo: { desactivar } }));
    await userEvent.click(await screen.findByRole('button', { name: /^Desactivar a / }));
    expect(desactivar).not.toHaveBeenCalled();
    const dialogo = await screen.findByText('¿Desactivar a Marco Suárez?');
    expect(dialogo).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
    await waitFor(() => {
      expect(desactivar).toHaveBeenCalledWith('2');
    });
  });

  it('editar cambia el nombre y reactivar vuelve a activar a un miembro desactivado', async () => {
    const renombrar = vi.fn(() => Promise.resolve());
    const reactivar = vi.fn(() => Promise.resolve());
    await irAEquipo(crearServiciosDePrueba({ equipo: { renombrar, reactivar } }));
    await userEvent.click(await screen.findByRole('button', { name: /^Editar a Marco/ }));
    const dialogo = await screen.findByRole('dialog');
    const campo = within(dialogo).getByLabelText('Nombre completo');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'Marco A. Suárez');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => {
      expect(renombrar).toHaveBeenCalledWith('2', 'Marco A. Suárez');
    });
    await userEvent.click(screen.getByRole('button', { name: /^Reactivar a / }));
    await waitFor(() => {
      expect(reactivar).toHaveBeenCalled();
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
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar administrador' }));
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
    expect(enviado?.contrasenaTemporal).toMatch(/^[A-Za-z0-9]{12}$/);
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
    expect(screen.getByText('21.600')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar precios' })).not.toBeInTheDocument();
    expect(screen.getByText('1.604')).toBeInTheDocument();
    expect(screen.getAllByText('QR ilimitados')).toHaveLength(3);
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

  it('cada fila trae ver, sitios y puertas, editar y eliminar', async () => {
    await irACuentas(crearServiciosDePrueba());
    const tabla = await screen.findByRole('table', { name: 'Cuentas' });
    for (const nombre of [
      'Ver Agroindustrial Norte',
      'Sitios y puertas de Agroindustrial Norte',
      'Editar Agroindustrial Norte',
      'Eliminar Agroindustrial Norte',
    ]) {
      expect(within(tabla).getByRole('button', { name: nombre })).toBeInTheDocument();
    }
    await userEvent.click(
      within(tabla).getByRole('button', { name: 'Eliminar Agroindustrial Norte' }),
    );
    expect(await screen.findByText('¿Eliminar Agroindustrial Norte?')).toBeInTheDocument();
  });

  it('filtrar por estado y buscar mandan los filtros al repositorio', async () => {
    const listar = vi.fn(() =>
      Promise.resolve({
        elementos: [],
        pagina: 1,
        porPagina: 10,
        total: 0,
        conteos: { todas: 0, activa: 0, porVencer: 0, vencida: 0, suspendida: 0, pendientePago: 0 },
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
              conteos: {
                todas: 0,
                activa: 0,
                porVencer: 0,
                vencida: 0,
                suspendida: 0,
                pendientePago: 0,
              },
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
    // La ciudad es una lista con búsqueda (react-select): se escribe y se elige.
    await userEvent.type(screen.getByLabelText('Ciudad'), 'Guarayos');
    await userEvent.click(await screen.findByText('Ascensión de Guarayos'));
    await userEvent.type(screen.getByLabelText(/Código de cuenta/), codigo);
    await userEvent.type(screen.getByLabelText('Nombre completo'), 'Rodrigo Añez');
    await userEvent.type(screen.getByLabelText('Teléfono'), '7 712 4405');
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'rodrigo@guarayos.bo');
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
          estado: 'pendientePago' as const,
        }),
    );
    await empezar(crearServiciosDePrueba({ cuentas: { crear } }));
    await llenarEmpresa();
    await screen.findByText('Disponible');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByRole('heading', { name: 'Elige el plan' })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('radio', { name: /200 usuarios/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    await userEvent.type(await screen.findByLabelText('Nombre del administrador'), 'Rodrigo Añez');
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
    await userEvent.type(await screen.findByLabelText('Nombre del administrador'), 'Rodrigo');
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
    await userEvent.type(await screen.findByLabelText('Nombre del administrador'), 'Rodrigo');
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
    expect(screen.getAllByText('Carla Méndez').length).toBeGreaterThan(0);
    // Sitios y puertas son dos indicadores arriba, con enlace a su pestaña.
    expect(screen.getByRole('link', { name: /Sitios\s*2/ })).toHaveAttribute(
      'href',
      '/cuentas/1?pestana=sitios',
    );
    expect(screen.getByRole('link', { name: /Puertas\s*5/ })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Persona responsable de la cuenta' }),
    ).toBeInTheDocument();
  });

  it('la pestaña Sitios y puertas muestra el estado de cada lector', async () => {
    await abrirDetalle(crearServiciosDePrueba());
    await userEvent.click(await screen.findByRole('tab', { name: 'Sitios y puertas' }));
    expect(await screen.findByText('Planta Warnes')).toBeInTheDocument();
    expect(screen.getByText('En línea')).toBeInTheDocument();
    expect(screen.getByText('Sin conexión')).toBeInTheDocument();
    expect(screen.getByText('5 segundos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo sitio' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Portón vehicular' })).toBeInTheDocument();
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

describe('suscripción de una cuenta (A05b, A06)', () => {
  async function abrirSuscripcion(servicios: Servicios) {
    montar(servicios, '/ingreso');
    await ingresar();
    await userEvent.click(await screen.findByRole('link', { name: /Cuentas/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Ver Agroindustrial Norte' }));
    await userEvent.click(await screen.findByRole('tab', { name: 'Suscripción' }));
  }

  it('muestra el resumen, el próximo pago y el historial con quién registró', async () => {
    await abrirSuscripcion(crearServiciosDePrueba());
    expect(await screen.findByText('Pendiente')).toBeInTheDocument();
    expect(screen.getAllByText('05/11/2025 – 05/11/2026')).toHaveLength(2);
    const historial = screen.getByRole('table', { name: 'Renovaciones y pagos' });
    expect(within(historial).getByText('TRF-884120')).toBeInTheDocument();
    expect(within(historial).getByText('Lucía Paz')).toBeInTheDocument();
    expect(within(historial).getByText('Transferencia')).toBeInTheDocument();
  });

  it('cambiar de plan solo ofrece planes mayores y muestra la diferencia a cobrar', async () => {
    await abrirSuscripcion(crearServiciosDePrueba());
    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar plan' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('+ Bs 9.600')).toBeInTheDocument();
    expect(within(dialogo).getByText(/Podrá crear hasta 200 usuarios/)).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: '200 usuarios' })).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: '350 usuarios' })).toBeInTheDocument();
    expect(within(dialogo).queryByRole('button', { name: '100 usuarios' })).not.toBeInTheDocument();
    expect(within(dialogo).getByText(/Solo puedes subir de plan/)).toBeInTheDocument();
  });

  it('confirmar el cambio avisa que falta cobrar la diferencia y lleva a registrarla', async () => {
    const cambiarPlan = vi.fn(() =>
      Promise.resolve({
        plan: { id: '2', nombre: '200 usuarios', cupoUsuarios: 200 },
        diferenciaPrecio: 9600,
      }),
    );
    await abrirSuscripcion(crearServiciosDePrueba({ suscripciones: { cambiarPlan } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar plan' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar a 200 usuarios' }));
    await waitFor(() => {
      expect(cambiarPlan).toHaveBeenCalledWith('1', '2');
    });
    expect(
      await screen.findByText(/Falta registrar el pago de la diferencia: Bs 9\.600/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Registrar pago de la diferencia' }));
    expect(await screen.findByLabelText('Monto')).toHaveValue('9.600');
    expect(screen.getByText(/diferencia por subir a 100 usuarios/)).toBeInTheDocument();
  });

  it('un error de la API al cambiar el plan se traduce', async () => {
    const cambiarPlan = vi.fn(() => Promise.reject(new ErrorApi(422, 'plan.solo_mejora')));
    await abrirSuscripcion(crearServiciosDePrueba({ suscripciones: { cambiarPlan } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar plan' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar a 200 usuarios' }));
    expect(
      await screen.findByText('Solo puedes cambiar a un plan con más cupo de usuarios.'),
    ).toBeInTheDocument();
  });

  it('en el plan más alto no hay nada que mejorar', async () => {
    const alto = {
      ...SUSCRIPCION,
      suscripcion: {
        ...SUSCRIPCION.suscripcion,
        plan: { id: '3', nombre: '350 usuarios', cupoUsuarios: 350, precioAnual: 33600 },
      },
    };
    await abrirSuscripcion(
      crearServiciosDePrueba({ suscripciones: { obtener: () => Promise.resolve(alto) } }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar plan' }));
    expect(await screen.findByText('Esta cuenta ya tiene el plan más alto.')).toBeInTheDocument();
  });

  it('suspender pide confirmación y llama a la API', async () => {
    const suspender = vi.fn(() => Promise.resolve());
    await abrirSuscripcion(crearServiciosDePrueba({ suscripciones: { suspender } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Suspender' }));
    expect(suspender).not.toHaveBeenCalled();
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText(/no emite QR/)).toBeInTheDocument();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Suspender' }));
    await waitFor(() => {
      expect(suspender).toHaveBeenCalledWith('1');
    });
  });

  it('una suscripción activa está al día: no ofrece renovar ni muestra "pendiente"', async () => {
    const activa = {
      ...SUSCRIPCION,
      suscripcion: { ...SUSCRIPCION.suscripcion, estado: 'activa' as const, diasRestantes: 200 },
    };
    await abrirSuscripcion(
      crearServiciosDePrueba({ suscripciones: { obtener: () => Promise.resolve(activa) } }),
    );
    expect(await screen.findByText(/Al día · vence el/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Renovar y registrar pago' })).toBeNull();
    expect(screen.queryByText('Pendiente')).toBeNull();
  });

  it('el historial muestra banco y cuenta, y abre el comprobante', async () => {
    const verComprobante = vi.fn(() => Promise.resolve(new Blob(['x'], { type: 'image/png' })));
    URL.createObjectURL = vi.fn(() => 'blob:prueba');
    URL.revokeObjectURL = vi.fn();
    const abrir = vi.spyOn(globalThis, 'open').mockReturnValue(null);
    await abrirSuscripcion(crearServiciosDePrueba({ suscripciones: { verComprobante } }));
    expect(await screen.findByText(/Banco Unión/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver comprobante' }));
    await waitFor(() => {
      expect(verComprobante).toHaveBeenCalledWith('77');
      expect(abrir).toHaveBeenCalledWith('blob:prueba', '_blank', 'noopener');
    });
    abrir.mockRestore();
  });

  it('suspendida: ofrece reactivar y no deja renovar ni cambiar de plan', async () => {
    const suspendida = {
      ...SUSCRIPCION,
      suscripcion: { ...SUSCRIPCION.suscripcion, estado: 'suspendida' as const },
      proximoPago: null,
    };
    await abrirSuscripcion(
      crearServiciosDePrueba({ suscripciones: { obtener: () => Promise.resolve(suspendida) } }),
    );
    expect(await screen.findByRole('button', { name: 'Reactivar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Renovar y registrar pago' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Cambiar plan' })).toBeDisabled();
    expect(screen.getByText(/La suscripción está suspendida/)).toBeInTheDocument();
  });
});

describe('registrar pago (A07)', () => {
  async function abrirPago(servicios: Servicios) {
    montar(servicios, '/ingreso');
    await ingresar();
    await userEvent.click(await screen.findByRole('link', { name: /Cuentas/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Ver Agroindustrial Norte' }));
    await userEvent.click(await screen.findByRole('tab', { name: 'Suscripción' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Renovar y registrar pago' }));
  }

  it('trae el precio vigente del plan y la nueva vigencia', async () => {
    await abrirPago(crearServiciosDePrueba());
    expect(await screen.findByLabelText('Monto')).toHaveValue('12.000');
    expect(screen.getByText('05/11/2026 → 05/11/2027')).toBeInTheDocument();
    expect(screen.getByText('Agroindustrial Norte · plan 100 usuarios')).toBeInTheDocument();
  });

  it('la referencia es obligatoria', async () => {
    await abrirPago(crearServiciosDePrueba());
    await screen.findByLabelText('Monto');
    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeDisabled();
  });

  it('confirma antes de registrar y manda el pago a la API', async () => {
    const registrar = vi.fn(() =>
      Promise.resolve({
        periodoDesde: new Date('2026-11-05T12:00:00Z'),
        periodoHasta: new Date('2027-11-05T12:00:00Z'),
        venceEl: new Date('2027-11-05T12:00:00Z'),
      }),
    );
    await abrirPago(crearServiciosDePrueba({ pagos: { registrar } }));
    await userEvent.type(await screen.findByLabelText('Referencia'), 'TRF-912204');
    await userEvent.click(screen.getByRole('button', { name: 'Depósito' }));
    // Un depósito exige banco, cuenta y el comprobante: sin ellos no se llega a confirmar.
    await userEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByLabelText('Banco donde se recibió'));
    await userEvent.click(await screen.findByRole('option', { name: 'Banco Unión' }));
    await userEvent.type(screen.getByLabelText('Cuenta de destino'), '10000123456');
    const comprobante = new File(['x'], 'boleta.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText('Comprobante'), comprobante);
    expect(await screen.findByText('boleta.png')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('¿Registrar el pago y renovar?')).toBeInTheDocument();
    expect(within(dialogo).getByText(/quedará vigente hasta el 05\/11\/2027/)).toBeInTheDocument();
    expect(registrar).not.toHaveBeenCalled();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar pago' }));
    await waitFor(() => {
      expect(registrar).toHaveBeenCalledWith(
        '1',
        'renovacion',
        expect.objectContaining({
          monto: 12000,
          medio: 'deposito',
          referencia: 'TRF-912204',
          banco: 'Banco Unión',
          cuentaDestino: '10000123456',
          comprobante,
        }),
      );
    });
    expect(
      await screen.findByRole('tab', { name: 'Suscripción', selected: true }),
    ).toBeInTheDocument();
  });

  it('un monto inválido marca el campo', async () => {
    await abrirPago(crearServiciosDePrueba());
    const monto = await screen.findByLabelText('Monto');
    await userEvent.clear(monto);
    await userEvent.type(monto, '12,5');
    await userEvent.tab();
    expect(await screen.findByText('Escribe un monto entero en bolivianos')).toBeInTheDocument();
  });
});

describe('cobranza (A08)', () => {
  async function abrirCobranza(servicios: Servicios) {
    montar(servicios, '/ingreso');
    await ingresar();
    await userEvent.click(await screen.findByRole('link', { name: /Cobranza/ }));
  }

  it('muestra los totales, la lista de la ventana y el acceso a registrar el pago', async () => {
    await abrirCobranza(crearServiciosDePrueba());
    // Cada monto sale en su tarjeta y de nuevo en el resumen "por cobrar" (PorCobrar).
    expect((await screen.findAllByText('Bs 100.800')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bs 298.800').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bs 33.600').length).toBeGreaterThan(0);
    expect(screen.getByText('Cobrado en 2026')).toBeInTheDocument();
    expect(screen.getByText('2 cuentas con accesos rechazados')).toBeInTheDocument();
    expect(screen.getByText('27 pagos registrados')).toBeInTheDocument();
    const tabla = screen.getByRole('table', { name: 'Cuentas por cobrar' });
    expect(within(tabla).getByText('Semillas del Este')).toBeInTheDocument();
    expect(within(tabla).getByText('en 6 días')).toBeInTheDocument();
    await userEvent.click(
      within(tabla).getByRole('button', { name: 'Registrar pago de Semillas del Este' }),
    );
    expect(await screen.findByRole('heading', { name: 'Registra el pago' })).toBeInTheDocument();
  });

  it('cambiar de ventana consulta la API con esa ventana', async () => {
    const cobranza = vi.fn(() => Promise.resolve(COBRANZA));
    await abrirCobranza(crearServiciosDePrueba({ pagos: { cobranza } }));
    await userEvent.click(await screen.findByRole('button', { name: /Vencidas/ }));
    await waitFor(() => {
      expect(cobranza).toHaveBeenLastCalledWith({ ventana: 'vencidas', busqueda: '' });
    });
  });

  it('sin nada por cobrar, estado vacío', async () => {
    await abrirCobranza(
      crearServiciosDePrueba({
        pagos: { cobranza: () => Promise.resolve({ ...COBRANZA, filas: [] }) },
      }),
    );
    expect(await screen.findByText('Nada por cobrar en 30 días')).toBeInTheDocument();
  });

  it('exportar a Excel baja el archivo con lo que se ve', async () => {
    const crear = vi.fn(() => 'blob:prueba');
    Object.defineProperty(URL, 'createObjectURL', { value: crear, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
    await abrirCobranza(crearServiciosDePrueba());
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar a Excel' }));
    await waitFor(() => {
      expect(crear).toHaveBeenCalledOnce();
    });
  });
});

describe('bitácora (A10)', () => {
  async function abrirBitacora(servicios: Servicios) {
    montar(servicios, '/ingreso');
    await ingresar();
    await userEvent.click(await screen.findByRole('link', { name: /Bitácora/ }));
  }

  it('describe cada evento con su texto, antes y después, y el origen', async () => {
    await abrirBitacora(crearServiciosDePrueba());
    const tabla = await screen.findByRole('table', { name: 'Bitácora' });
    expect(within(tabla).getByText('Registró pago')).toBeInTheDocument();
    expect(within(tabla).getByText('Bs 12.000 · TRF-1')).toBeInTheDocument();
    expect(within(tabla).getByText('Cambió plan')).toBeInTheDocument();
    expect(within(tabla).getByText('100 usuarios')).toBeInTheDocument();
    expect(within(tabla).getByText('Sistema')).toBeInTheDocument();
    expect(within(tabla).getByText('Automático')).toBeInTheDocument();
    expect(within(tabla).getAllByText('Panel')).toHaveLength(2);
    expect(screen.getByText('Mostrando 1–10 de 184')).toBeInTheDocument();
  });

  it('filtrar por cuenta y por acción consulta la API con esos filtros', async () => {
    const listar = vi.fn(() =>
      Promise.resolve({ elementos: [], pagina: 1, porPagina: 10, total: 0 }),
    );
    await abrirBitacora(crearServiciosDePrueba({ bitacora: { listar } }));
    await userEvent.click(await screen.findByLabelText('Acción'));
    await userEvent.click(await screen.findByRole('option', { name: 'Creó' }));
    await waitFor(() => {
      expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ accion: 'creado' }), 10);
    });
    await userEvent.click(screen.getByLabelText('Cuenta'));
    await userEvent.click(await screen.findByRole('option', { name: /AGR/ }));
    await waitFor(() => {
      expect(listar).toHaveBeenLastCalledWith(
        expect.objectContaining({ cuentaId: '1', accion: 'creado' }),
        10,
      );
    });
    expect(await screen.findByText('Sin acciones con estos filtros')).toBeInTheDocument();
  });

  it('error de carga con reintento', async () => {
    await abrirBitacora(
      crearServiciosDePrueba({
        bitacora: { listar: () => Promise.reject(new ErrorApi(500, 'interno')) },
      }),
    );
    expect(await screen.findByText('No pudimos cargar la bitácora')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('un código de evento que el panel no conoce no sale en crudo', async () => {
    await abrirBitacora(
      crearServiciosDePrueba({
        bitacora: {
          listar: () =>
            Promise.resolve({
              elementos: [
                {
                  ...EVENTOS[0],
                  id: '9',
                  codigo: 'cosa.nueva',
                  despues: null,
                } as (typeof EVENTOS)[number],
              ],
              pagina: 1,
              porPagina: 10,
              total: 1,
            }),
        },
      }),
    );
    expect(await screen.findByText('Creó cosa')).toBeInTheDocument();
  });

  it('la pestaña Bitácora de una cuenta filtra por esa cuenta y no repite la columna Cuenta', async () => {
    const listar = vi.fn(() =>
      Promise.resolve({ elementos: EVENTOS, pagina: 1, porPagina: 10, total: 3 }),
    );
    const servicios = crearServiciosDePrueba({ bitacora: { listar } });
    montar(servicios, '/ingreso');
    await ingresar();
    await userEvent.click(await screen.findByRole('link', { name: /Cuentas/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Ver Agroindustrial Norte' }));
    await userEvent.click(await screen.findByRole('tab', { name: 'Bitácora' }));
    await waitFor(() => {
      expect(listar).toHaveBeenCalledWith(expect.objectContaining({ cuentaId: '1' }), 10);
    });
    const tabla = await screen.findByRole('table', { name: 'Bitácora' });
    expect(within(tabla).queryByRole('columnheader', { name: 'Cuenta' })).not.toBeInTheDocument();
  });
});

describe('resumen (A02)', () => {
  it('es la pantalla de inicio: indicadores, renovaciones y últimas acciones', async () => {
    montar(crearServiciosDePrueba(), '/ingreso');
    await ingresar();
    expect(await screen.findByRole('heading', { name: 'Resumen' })).toBeInTheDocument();
    expect(await screen.findByText('38')).toBeInTheDocument();
    expect(screen.getByText('de 42 cuentas · 5 por vencer')).toBeInTheDocument();
    expect(screen.getByText('5.214')).toBeInTheDocument();
    expect(screen.getByText('de 7.650 de cupo vendido · 68%')).toBeInTheDocument();
    expect(screen.getByText('Suman Bs 100.800')).toBeInTheDocument();
    expect(screen.getByText('Bs 812.400')).toBeInTheDocument();
    expect(screen.getByText('en 6 días')).toBeInTheDocument();
    expect(screen.getByText('hace 10 días')).toBeInTheDocument();
    expect(screen.getByText(/Registró pago · FRO/)).toBeInTheDocument();
  });

  it('muestra los dispositivos con los que no reportan primero', async () => {
    montar(crearServiciosDePrueba(), '/ingreso');
    await ingresar();
    expect(await screen.findByText('1 en línea · 1 sin conexión')).toBeInTheDocument();
    const filas = screen.getAllByText(/Controlador/).map((e) => e.textContent);
    expect(filas).toEqual(['Controlador portón', 'Controlador principal']);
    expect(screen.getByText('Sin conexión')).toBeInTheDocument();
    expect(screen.getByText('En línea')).toBeInTheDocument();
  });

  it('error de carga con reintento', async () => {
    montar(
      crearServiciosDePrueba({
        resumen: { obtener: () => Promise.reject(new ErrorApi(500, 'interno')) },
      }),
      '/ingreso',
    );
    await ingresar();
    expect(await screen.findByText('No pudimos cargar el resumen')).toBeInTheDocument();
  });
});

describe('gestión de planes (A09)', () => {
  async function irAPlanes(servicios: Servicios) {
    montar(servicios, '/ingreso');
    await ingresar();
    await userEvent.click(await screen.findByRole('link', { name: /Planes/ }));
  }

  it('crea un plan con nombre, cupo y precio', async () => {
    const crear = vi.fn(() => Promise.resolve());
    await irAPlanes(crearServiciosDePrueba({ planes: { crear } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo plan' }));
    const dialogo = await screen.findByRole('dialog');
    const crearBoton = within(dialogo).getByRole('button', { name: 'Crear plan' });
    expect(crearBoton).toBeDisabled();
    await userEvent.type(within(dialogo).getByLabelText('Nombre del plan'), '500 usuarios');
    await userEvent.type(within(dialogo).getByLabelText('Cupo de usuarios activos'), '500');
    await userEvent.type(within(dialogo).getByLabelText('Precio anual'), '45.000');
    await userEvent.click(crearBoton);
    await waitFor(() => {
      expect(crear).toHaveBeenCalledWith({
        nombre: '500 usuarios',
        cupoUsuarios: 500,
        precioAnual: 45000,
      });
    });
  });

  it('edita un plan: parte de sus valores y bloquea el cupo si ya lo usan cuentas', async () => {
    const editar = vi.fn(() => Promise.resolve());
    await irAPlanes(crearServiciosDePrueba({ planes: { editar } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Editar 100 usuarios' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByLabelText('Nombre del plan')).toHaveValue('100 usuarios');
    expect(within(dialogo).getByLabelText('Cupo de usuarios activos')).toBeDisabled();
    expect(within(dialogo).getByText(/ya lo usan cuentas/)).toBeInTheDocument();
    const nombre = within(dialogo).getByLabelText('Nombre del plan');
    await userEvent.clear(nombre);
    await userEvent.type(nombre, 'Básico');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => {
      expect(editar).toHaveBeenCalledWith('1', {
        nombre: 'Básico',
        cupoUsuarios: 100,
        precioAnual: 12000,
      });
    });
  });

  it('un error de la API al crear se traduce', async () => {
    const crear = vi.fn(() => Promise.reject(new ErrorApi(409, 'plan.nombre_existente')));
    await irAPlanes(crearServiciosDePrueba({ planes: { crear } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo plan' }));
    const dialogo = await screen.findByRole('dialog');
    await userEvent.type(within(dialogo).getByLabelText('Nombre del plan'), '100 usuarios');
    await userEvent.type(within(dialogo).getByLabelText('Cupo de usuarios activos'), '100');
    await userEvent.type(within(dialogo).getByLabelText('Precio anual'), '1');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Crear plan' }));
    expect(await screen.findByText('Ya hay un plan con ese nombre.')).toBeInTheDocument();
  });

  it('retirar explica que las cuentas lo conservan y pide confirmación', async () => {
    const retirar = vi.fn(() => Promise.resolve('retirado' as const));
    await irAPlanes(crearServiciosDePrueba({ planes: { retirar } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Retirar 100 usuarios' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('¿Retirar el plan 100 usuarios?')).toBeInTheDocument();
    expect(within(dialogo).getByText(/21 cuentas lo tienen y lo conservan/)).toBeInTheDocument();
    expect(retirar).not.toHaveBeenCalled();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Retirar' }));
    await waitFor(() => {
      expect(retirar).toHaveBeenCalledWith('1');
    });
  });
});

describe('administradores, PIN y código de la cuenta (ADR 0023)', () => {
  async function abrirCuenta(servicios: Servicios) {
    montar(servicios, '/ingreso');
    await ingresar();
    await userEvent.click(await screen.findByRole('link', { name: /Cuentas/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Ver Agroindustrial Norte' }));
  }

  it('lista los administradores con su último ingreso y su PIN', async () => {
    await abrirCuenta(crearServiciosDePrueba());
    expect(await screen.findByText(/Nunca ingresó/)).toBeInTheDocument();
    expect(screen.getAllByText('Carla Méndez')).toHaveLength(2);
    expect(screen.getByText(/PIN generado 01\/09\/2026/)).toBeInTheDocument();
  });

  it('regenerar el PIN pide confirmación y muestra el PIN nuevo una sola vez', async () => {
    const regenerarPin = vi.fn(() => Promise.resolve('AGR7K2Q'));
    await abrirCuenta(crearServiciosDePrueba({ cuentas: { regenerarPin } }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Regenerar el PIN de Carla Méndez' }),
    );
    const confirmar = await screen.findByRole('dialog');
    expect(within(confirmar).getByText(/El anterior deja de servir/)).toBeInTheDocument();
    expect(regenerarPin).not.toHaveBeenCalled();
    await userEvent.click(within(confirmar).getByRole('button', { name: 'Regenerar PIN' }));
    await waitFor(() => {
      expect(regenerarPin).toHaveBeenCalledWith('1', '11');
    });
    expect(await screen.findByRole('img', { name: 'A G R 7 K 2 Q' })).toBeInTheDocument();
    expect(screen.getByText(/Este PIN no se vuelve a mostrar/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ya lo copié' }));
    await waitFor(() => {
      expect(screen.queryByRole('img', { name: 'A G R 7 K 2 Q' })).not.toBeInTheDocument();
    });
    expect(JSON.stringify(Object.entries(localStorage))).not.toContain('7K2Q');
  });

  it('cambiar el código valida que esté libre y explica qué le pasa a los PIN', async () => {
    const cambiarCodigo = vi.fn(() => Promise.resolve());
    await abrirCuenta(crearServiciosDePrueba({ cuentas: { cambiarCodigo } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar código' }));
    const dialogo = await screen.findByRole('dialog');
    expect(
      within(dialogo).getByText(/Las 3 primeras letras del PIN de todos sus usuarios/),
    ).toBeInTheDocument();
    const entrada = within(dialogo).getByLabelText('Código nuevo · 3 letras');
    await userEvent.type(entrada, 'fro');
    expect(
      await within(dialogo).findByText(/Ese código ya es de Frigorífico Oriente/),
    ).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Cambiar código' })).toBeDisabled();
    await userEvent.clear(entrada);
    await userEvent.type(entrada, 'xyz');
    expect(await within(dialogo).findByText('Disponible')).toBeInTheDocument();
    expect(within(dialogo).getByText(/el PIN AGR7K2Q pasa a ser XYZ7K2Q/)).toBeInTheDocument();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cambiar código' }));
    await waitFor(() => {
      expect(cambiarCodigo).toHaveBeenCalledWith('1', 'XYZ');
    });
  });
});

describe('placas (ADR 0026)', () => {
  async function irAPlacas(servicios: Servicios) {
    montar(servicios, '/ingreso');
    await ingresar();
    await userEvent.click(await screen.findByRole('link', { name: /Placas/ }));
  }

  it('lista el inventario con su estado y solo ofrece cada acción donde corresponde', async () => {
    await irAPlacas(crearServiciosDePrueba());
    const tabla = await screen.findByRole('table', { name: 'Placas' });
    expect(within(tabla).getByText('AA:BB:CC:00:11:22')).toBeInTheDocument();
    expect(within(tabla).getByText('Agroindustrial Norte', { exact: false })).toBeInTheDocument();
    expect(within(tabla).getByText('Vinculada')).toBeInTheDocument();
    expect(within(tabla).getByText('Detectada')).toBeInTheDocument();
    expect(within(tabla).getByText('Esperando el botón')).toBeInTheDocument();
    // Vincular solo en la detectada, cancelar solo en la que espera su botón, liberar solo en la
    // vinculada y baja en las que no tienen dispositivo.
    expect(within(tabla).getAllByRole('button', { name: /^Vincular la placa / })).toHaveLength(1);
    expect(
      within(tabla).getAllByRole('button', { name: /^Cancelar el vínculo de la placa / }),
    ).toHaveLength(1);
    expect(within(tabla).getAllByRole('button', { name: /^Liberar la placa / })).toHaveLength(1);
    expect(within(tabla).getAllByRole('button', { name: /^Dar de baja la placa / })).toHaveLength(
      2,
    );
  });

  it('ya no se registra a mano: no hay botón de registrar', async () => {
    await irAPlacas(crearServiciosDePrueba());
    await screen.findByRole('table', { name: 'Placas' });
    expect(screen.queryByRole('button', { name: 'Registrar placa' })).not.toBeInTheDocument();
  });

  it('vincular: elige cuenta y una puerta sin lector y envía los ids', async () => {
    const vincular = vi.fn<PlacasRepositorio['vincular']>(() =>
      Promise.resolve({ porConfirmarHasta: new Date(Date.now() + 10 * 60_000) }),
    );
    const sitiosYPuertas = () =>
      Promise.resolve([
        {
          id: '1',
          nombre: 'Planta Warnes',
          direccion: null,
          zonaHoraria: 'America/La_Paz',
          activo: true,
          puertas: [
            {
              id: '1',
              nombre: 'Portón vehicular',
              segundosApertura: 5,
              activa: true,
              dispositivo: { id: '1', nombre: 'LECT-0042', enLinea: true, ultimaSenal: new Date() },
            },
            {
              id: '3',
              nombre: 'Garaje',
              segundosApertura: 5,
              activa: true,
              dispositivo: null,
            },
          ],
        },
      ]);
    await irAPlacas(crearServiciosDePrueba({ placas: { vincular }, cuentas: { sitiosYPuertas } }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Vincular la placa AA:BB:CC:00:11:33' }),
    );
    const dialogo = await screen.findByRole('dialog');
    await userEvent.click(within(dialogo).getByLabelText('Cuenta'));
    await userEvent.click(
      await screen.findByRole('option', { name: 'AGR · Agroindustrial Norte' }),
    );
    await userEvent.click(within(dialogo).getByLabelText('Puerta'));
    // La puerta que ya tiene lector no se ofrece.
    expect(
      screen.queryByRole('option', { name: 'Planta Warnes · Portón vehicular' }),
    ).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('option', { name: 'Planta Warnes · Garaje' }));
    expect(within(dialogo).getByLabelText('Nombre del lector')).toHaveValue('Garaje');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Pedir vínculo' }));
    await waitFor(() => {
      expect(vincular).toHaveBeenCalledWith('2', {
        cuentaId: '1',
        puertaId: '3',
        nombre: 'Garaje',
      });
    });
    // El vínculo no está hecho: el panel explica cómo confirmarlo en la puerta.
    expect(await screen.findByText('Confirma en la puerta')).toBeInTheDocument();
    expect(screen.getByText(/Mantén pulsado el pulsador de salida/)).toBeInTheDocument();
  });

  it('cancelar el vínculo de una placa que espera su botón envía su id', async () => {
    const cancelarVinculo = vi.fn(() => Promise.resolve());
    await irAPlacas(crearServiciosDePrueba({ placas: { cancelarVinculo } }));
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Cancelar el vínculo de la placa AA:BB:CC:00:11:44',
      }),
    );
    await waitFor(() => {
      expect(cancelarVinculo).toHaveBeenCalledWith('3');
    });
  });

  it('liberar pide confirmación y la API recibe el id de la placa', async () => {
    const liberar = vi.fn(() => Promise.resolve());
    await irAPlacas(crearServiciosDePrueba({ placas: { liberar } }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Liberar la placa AA:BB:CC:00:11:22' }),
    );
    expect(await screen.findByText('¿Liberar la placa AA:BB:CC:00:11:22?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Liberar' }));
    await waitFor(() => {
      expect(liberar).toHaveBeenCalledWith('1');
    });
  });

  it('un error de la API se muestra traducido', async () => {
    const liberar = () => Promise.reject(new ErrorApi(409, 'placa.sin_dispositivo'));
    await irAPlacas(crearServiciosDePrueba({ placas: { liberar } }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Liberar la placa AA:BB:CC:00:11:22' }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Liberar' }));
    expect(
      await screen.findByText('La placa no está vinculada a ninguna puerta.'),
    ).toBeInTheDocument();
  });

  it('sin el permiso de placas, el rail no la ofrece', async () => {
    const servicios = crearServiciosDePrueba({
      seguridad: {
        ingresar: () =>
          Promise.resolve({
            usuario: { id: '1', nombre: 'Lucía Paz', usuario: 'lucia.paz' },
            debeCambiarContrasena: false,
            permisos: ['resumen.panel.ver'],
          }),
      },
    });
    montar(servicios, '/ingreso');
    await ingresar();
    await screen.findByRole('navigation', { name: 'AGROCOM Acceso' });
    expect(screen.queryByRole('link', { name: /Placas/ })).not.toBeInTheDocument();
  });
});
