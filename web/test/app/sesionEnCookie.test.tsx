import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRutas } from '@/app/AppRutas';
import { crearServicios } from '@/app/providers/crearServicios';
import { ProveedoresApp } from '@/app/providers/ProveedoresApp';

interface LlamadaFetch {
  url: string;
  metodo: string;
  cliente: string | null;
  cuerpo: string | null;
}

/**
 * Simula la API con su contrato real de sesión: sin cookie, el refresco responde 401; el ingreso
 * devuelve el acceso y deja el refresco en la cookie (no en el cuerpo). Todo lo demás responde 404.
 */
function apiFalsa() {
  const llamadas: LlamadaFetch[] = [];
  const falso = vi.fn<typeof fetch>((url, init) => {
    const cabeceras = new Headers(init?.headers);
    const ruta = url instanceof Request ? url.url : String(url);
    llamadas.push({
      url: ruta,
      metodo: init?.method ?? 'GET',
      cliente: cabeceras.get('X-Requested-With'),
      cuerpo: typeof init?.body === 'string' ? init.body : null,
    });
    if (ruta.endsWith('/sesiones/refresco')) {
      return Promise.resolve(
        new Response(JSON.stringify({ code: 'sesion.refresco_invalido' }), { status: 401 }),
      );
    }
    if (ruta.endsWith('/plataforma/sesiones')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            acceso: 'a',
            usuario: { id: '1', nombre: 'Lucía Paz', usuario: 'lucia.paz' },
            debe_cambiar_contrasena: false,
            permisos: [],
          }),
          { status: 200 },
        ),
      );
    }
    return Promise.resolve(new Response(JSON.stringify({ code: 'desconocido' }), { status: 404 }));
  });
  vi.stubGlobal('fetch', falso);
  return llamadas;
}

function montar() {
  const servicios = crearServicios('/api/v1');
  return render(
    <ProveedoresApp servicios={servicios} reintentos={0}>
      <MemoryRouter initialEntries={['/']}>
        <AppRutas />
      </MemoryRouter>
    </ProveedoresApp>,
  );
}

describe('sesión con cookie de refresco (ADR 0033 §5)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('al arrancar pide el refresco sin cuerpo y con la cabecera del panel; sin cookie muestra el ingreso', async () => {
    const llamadas = apiFalsa();
    montar();
    expect(await screen.findByRole('heading', { name: 'Ingresa al panel' })).toBeInTheDocument();
    expect(llamadas[0]).toEqual({
      url: '/api/v1/sesiones/refresco',
      metodo: 'POST',
      cliente: 'agrocom-panel',
      cuerpo: '{}',
    });
  });

  it('el ingreso se anuncia como panel y no deja el refresco en el almacenamiento del navegador', async () => {
    const llamadas = apiFalsa();
    montar();
    await screen.findByRole('heading', { name: 'Ingresa al panel' });
    await userEvent.type(screen.getByLabelText('Usuario'), 'lucia.paz');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'secreta-12345');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => {
      expect(llamadas.some((l) => l.url === '/api/v1/plataforma/sesiones')).toBe(true);
    });
    const ingreso = llamadas.find((l) => l.url === '/api/v1/plataforma/sesiones');
    expect(ingreso).toMatchObject({ metodo: 'POST', cliente: 'agrocom-panel' });
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
