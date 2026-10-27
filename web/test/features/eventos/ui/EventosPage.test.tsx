import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { EventosPage } from '@/features/eventos/ui/pages/EventosPage';
import type { EventosRepositorio } from '@/features/eventos/api/EventosRepositorio';
import type { EventoDeAcceso } from '@/features/eventos/domain/evento';
import { ProveedoresApp } from '@/app/providers/ProveedoresApp';
import { crearServiciosDePrueba } from '../../../servicios';

const FALLIDA: EventoDeAcceso = {
  id: '55',
  ocurridoEn: new Date('2026-10-27T12:00:00Z'),
  resultado: 'permitido',
  motivoCode: 'acceso.permitido',
  cuenta: { id: '1', codigo: 'AGR', nombre: 'Agroindustrial Norte' },
  puerta: { id: '3', nombre: 'Portón vehicular', sitio: 'Planta Warnes' },
  dispositivo: 'LECT-0042',
  qrEtiqueta: null,
  ejecucion: 'fallida',
  ejecucionCausa: 'puerta_no_abrio',
};

function montar(listar: EventosRepositorio['listar'], ruta = '/accesos') {
  return render(
    <ProveedoresApp servicios={crearServiciosDePrueba({ eventos: { listar } })} reintentos={0}>
      <MemoryRouter initialEntries={[ruta]}>
        <EventosPage />
      </MemoryRouter>
    </ProveedoresApp>,
  );
}

describe('accesos: ejecución de la orden de abrir', () => {
  it('muestra la falla con su causa en la tabla', async () => {
    montar(() => Promise.resolve({ elementos: [FALLIDA], pagina: 1, porPagina: 15, total: 1 }));
    const tabla = await screen.findByRole('table', { name: 'Accesos' });
    expect(await within(tabla).findByText('La puerta no se abrió')).toBeInTheDocument();
    expect(within(tabla).getByText('Portón vehicular')).toBeInTheDocument();
  });

  it('el filtro de ejecución manda el desenlace a la API y queda en la URL', async () => {
    const listar = vi.fn<EventosRepositorio['listar']>(() =>
      Promise.resolve({ elementos: [], pagina: 1, porPagina: 15, total: 0 }),
    );
    montar(listar);
    await userEvent.click(await screen.findByRole('button', { name: 'No abrió' }));
    expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ ejecucion: 'fallida' }), 15);
  });

  it('un enlace con ?ejecucion= arranca filtrado', async () => {
    const listar = vi.fn<EventosRepositorio['listar']>(() =>
      Promise.resolve({ elementos: [], pagina: 1, porPagina: 15, total: 0 }),
    );
    montar(listar, '/accesos?ejecucion=sin_confirmacion');
    await screen.findByText('Sin accesos con estos filtros');
    expect(listar).toHaveBeenCalledWith(
      expect.objectContaining({ ejecucion: 'sin_confirmacion' }),
      15,
    );
  });
});
