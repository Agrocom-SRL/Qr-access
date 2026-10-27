import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CampanaNotificaciones } from '@/features/notificaciones/ui/components/CampanaNotificaciones';
import type { NotificacionesRepositorio } from '@/features/notificaciones/api/NotificacionesRepositorio';
import { ProveedoresApp } from '@/app/providers/ProveedoresApp';
import { ErrorApi, NOTIFICACIONES, crearServiciosDePrueba } from '../../../servicios';

function montar(notificaciones: Partial<NotificacionesRepositorio> = {}, puedeGestionar = true) {
  const servicios = crearServiciosDePrueba({ notificaciones });
  return render(
    <ProveedoresApp servicios={servicios} reintentos={0}>
      <MemoryRouter>
        <CampanaNotificaciones puedeGestionar={puedeGestionar} />
      </MemoryRouter>
    </ProveedoresApp>,
  );
}

async function abrirBandeja() {
  await userEvent.click(await screen.findByRole('button', { name: /Notificaciones: 1 sin leer/ }));
  return screen.findByRole('dialog', { name: 'Notificaciones' });
}

describe('campana de avisos de AGROCOM', () => {
  it('muestra cuántos avisos quedan sin leer, con texto además del número', async () => {
    montar();
    expect(
      await screen.findByRole('button', { name: 'Notificaciones: 1 sin leer' }),
    ).toBeInTheDocument();
  });

  it('sin avisos sin leer, la campana no muestra contador', async () => {
    montar({ noLeidas: () => Promise.resolve(0) });
    expect(
      await screen.findByRole('button', { name: 'Notificaciones: 0 sin leer' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('la bandeja agrupa los avisos por sitio y traduce el tipo y la severidad', async () => {
    montar();
    const bandeja = await abrirBandeja();
    expect(
      within(bandeja).getByRole('heading', { name: 'Planta Warnes', level: 3 }),
    ).toBeInTheDocument();
    // Un aviso de la cuenta entera (sin sitio) va en su propio grupo.
    expect(
      within(bandeja).getByRole('heading', { name: 'Toda la cuenta', level: 3 }),
    ).toBeInTheDocument();
    expect(
      within(bandeja).getByText('Una puerta no abre tras varios intentos'),
    ).toBeInTheDocument();
    expect(within(bandeja).getByText('Una placa dejó de reportar')).toBeInTheDocument();
    expect(within(bandeja).getByText('Crítica')).toBeInTheDocument();
    expect(within(bandeja).getByText('Portón vehicular')).toBeInTheDocument();
    expect(within(bandeja).getByText('3 aperturas sin confirmar')).toBeInTheDocument();
    expect(within(bandeja).getByText('La puerta no se abrió')).toBeInTheDocument();
  });

  it('leer y descartar llaman a la API con el aviso; leer todas marca todo', async () => {
    const leer = vi.fn<NotificacionesRepositorio['leer']>(() => Promise.resolve());
    const descartar = vi.fn<NotificacionesRepositorio['descartar']>(() => Promise.resolve());
    const leerTodas = vi.fn<NotificacionesRepositorio['leerTodas']>(() => Promise.resolve(1));
    montar({ leer, descartar, leerTodas });
    const bandeja = await abrirBandeja();

    await userEvent.click(within(bandeja).getByRole('button', { name: 'Marcar como leída' }));
    expect(leer).toHaveBeenCalledWith(NOTIFICACIONES[0]?.id);

    const botonesDescartar = within(bandeja).getAllByRole('button', { name: 'Descartar' });
    expect(botonesDescartar).toHaveLength(2);
    await userEvent.click(botonesDescartar[0] as HTMLElement);
    expect(descartar).toHaveBeenCalledWith(NOTIFICACIONES[0]?.id);

    await userEvent.click(
      within(bandeja).getByRole('button', { name: 'Marcar todas como leídas' }),
    );
    expect(leerTodas).toHaveBeenCalledTimes(1);
  });

  it('quien solo mira la bandeja no ve leer ni descartar', async () => {
    montar({}, false);
    const bandeja = await abrirBandeja();
    expect(within(bandeja).queryByRole('button', { name: 'Descartar' })).not.toBeInTheDocument();
    expect(
      within(bandeja).queryByRole('button', { name: 'Marcar como leída' }),
    ).not.toBeInTheDocument();
    expect(
      within(bandeja).queryByRole('button', { name: 'Marcar todas como leídas' }),
    ).not.toBeInTheDocument();
  });

  it('un error al cargar la bandeja se traduce por su código y deja reintentar', async () => {
    const listar = vi
      .fn<NotificacionesRepositorio['listar']>()
      .mockRejectedValueOnce(new ErrorApi(500, 'desconocido'))
      .mockResolvedValue({
        elementos: NOTIFICACIONES,
        pagina: 1,
        porPagina: 10,
        total: NOTIFICACIONES.length,
      });
    montar({ listar });
    const bandeja = await abrirBandeja();
    expect(
      await within(bandeja).findByText('No pudimos cargar las notificaciones'),
    ).toBeInTheDocument();
    await userEvent.click(within(bandeja).getByRole('button', { name: 'Reintentar' }));
    expect(await within(bandeja).findByText('Planta Warnes')).toBeInTheDocument();
  });

  it('sin avisos sin leer, dice que todo está al día', async () => {
    montar({
      noLeidas: () => Promise.resolve(0),
      listar: () => Promise.resolve({ elementos: [], pagina: 1, porPagina: 10, total: 0 }),
    });
    await userEvent.click(await screen.findByRole('button', { name: /sin leer/ }));
    const bandeja = await screen.findByRole('dialog', { name: 'Notificaciones' });
    expect(await within(bandeja).findByText('Todo al día')).toBeInTheDocument();
  });

  it('un aviso nuevo se anuncia a los lectores de pantalla, sin mover el foco', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const noLeidas = vi
        .fn<NotificacionesRepositorio['noLeidas']>()
        .mockResolvedValueOnce(1)
        .mockResolvedValue(3);
      montar({ noLeidas });
      await screen.findByRole('button', { name: 'Notificaciones: 1 sin leer' });
      // Tras el primer contador no hay novedad: lo que ya estaba sin leer no se anuncia.
      expect(screen.getByRole('status').textContent).toBe('');

      // El refresco periódico de la campana trae dos avisos nuevos.
      await vi.advanceTimersByTimeAsync(30_000);
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent('Llegaron 2 notificaciones nuevas'),
      );
      expect(
        screen.getByRole('button', { name: 'Notificaciones: 3 sin leer' }),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
