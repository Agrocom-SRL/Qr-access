import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProveedoresApp } from '@/app/providers/ProveedoresApp';
import type { NotificacionesRepositorio } from '@/features/notificaciones/api/NotificacionesRepositorio';
import type { Notificacion } from '@/features/notificaciones/domain/notificacion';
import { TarjetaDeNotificacion } from '@/features/notificaciones/ui/components/TarjetaDeNotificacion';
import { NotificacionesPage } from '@/features/notificaciones/ui/pages/NotificacionesPage';
import { SUPER_ADMIN, crearServiciosDePrueba } from '../../../servicios';

const BASE: Omit<Notificacion, 'propuesta'> = {
  id: '910',
  tipo: 'incidente.propuesta',
  severidad: 'aviso',
  cuenta: { id: '1', codigo: 'AGR', nombre: 'Agroindustrial Norte' },
  sitio: null,
  leida: false,
  placas: [],
  novedadEn: new Date('2026-10-27T12:00:00Z'),
  creadaEn: new Date('2026-10-27T11:00:00Z'),
};

const PROPUESTA: Notificacion['propuesta'] = {
  accion: 'restringir',
  usuarioId: '31',
  usuarioEtiqueta: 'Jorge Rivero',
  incidenteId: '901',
  incidenteTipo: 'uso_masivo',
  confirmados: 3,
  minimo: 3,
  ventanaDias: 30,
  aplicadaAutomaticamente: false,
};

function tarjeta(aviso: Notificacion) {
  return render(
    <TarjetaDeNotificacion
      notificacion={aviso}
      puedeGestionar={false}
      onLeer={() => undefined}
      onDescartar={() => undefined}
    />,
  );
}

describe('propuesta de incidente en la bandeja', () => {
  it('dice qué se propone a quién, con sus cifras, y que nadie la aplicó todavía', () => {
    tarjeta({ ...BASE, propuesta: PROPUESTA });
    expect(
      screen.getByText('El sistema propone una acción sobre un usuario reincidente'),
    ).toBeInTheDocument();
    expect(screen.getByText('Propone restringir a Jorge Rivero')).toBeInTheDocument();
    expect(screen.getByText('3 de 3 incidentes confirmados en 30 días')).toBeInTheDocument();
    expect(
      screen.getByText('Nadie la aplicó todavía: la decide una persona de la cuenta.'),
    ).toBeInTheDocument();
  });

  it('suspender y anular dice que también se anulan los QR vigentes', () => {
    tarjeta({
      ...BASE,
      severidad: 'critica',
      propuesta: { ...PROPUESTA, accion: 'suspender_y_anular' },
    });
    expect(
      screen.getByText('Propone suspender a Jorge Rivero y anular sus QR vigentes'),
    ).toBeInTheDocument();
  });

  it('si el sistema ya restringió al usuario, la tarjeta lo dice en vez de pedir una decisión', () => {
    tarjeta({ ...BASE, propuesta: { ...PROPUESTA, aplicadaAutomaticamente: true } });
    expect(
      screen.getByText('El sistema ya lo restringió de forma automática. Revisa si corresponde.'),
    ).toBeInTheDocument();
  });

  it('sin nombre de usuario no inventa uno', () => {
    tarjeta({ ...BASE, propuesta: { ...PROPUESTA, usuarioEtiqueta: null } });
    expect(screen.getByText('Propone restringir a este usuario')).toBeInTheDocument();
  });
});

function montarPagina(permisos: string[], notificaciones: Partial<NotificacionesRepositorio> = {}) {
  const servicios = crearServiciosDePrueba({
    seguridad: {
      restaurar: () =>
        Promise.resolve({
          usuario: SUPER_ADMIN.usuario,
          debeCambiarContrasena: false,
          permisos,
        }),
    },
    notificaciones,
  });
  servicios.almacen.guardar({ acceso: 'a', refresco: 'r' });
  return render(
    <ProveedoresApp servicios={servicios} reintentos={0}>
      <MemoryRouter>
        <NotificacionesPage />
      </MemoryRouter>
    </ProveedoresApp>,
  );
}

describe('pantalla completa de avisos de AGROCOM', () => {
  it('filtra por tipo y pide a la API solo ese tipo', async () => {
    const listar = vi.fn<NotificacionesRepositorio['listar']>(() =>
      Promise.resolve({ elementos: [], pagina: 1, porPagina: 10, total: 0 }),
    );
    montarPagina(['notificaciones.aviso_plataforma.ver'], { listar });
    const selector = await screen.findByRole('combobox', { name: 'Tipo de aviso' });
    await userEvent.selectOptions(selector, 'incidente.propuesta');
    expect(listar).toHaveBeenLastCalledWith('no_leidas', 1, 'incidente.propuesta');
  });

  it('quien solo mira no ve «Marcar todas como leídas»', async () => {
    montarPagina(['notificaciones.aviso_plataforma.ver']);
    await screen.findByRole('heading', { name: 'Avisos', level: 1 });
    expect(
      screen.queryByRole('button', { name: 'Marcar todas como leídas' }),
    ).not.toBeInTheDocument();
  });

  it('quien gestiona ve la lista y puede marcar todas como leídas', async () => {
    const leerTodas = vi.fn(() => Promise.resolve(2));
    montarPagina(
      ['notificaciones.aviso_plataforma.ver', 'notificaciones.aviso_plataforma.gestionar'],
      { leerTodas },
    );
    await screen.findByText('Planta Warnes');
    await userEvent.click(screen.getByRole('button', { name: 'Marcar todas como leídas' }));
    expect(leerTodas).toHaveBeenCalledTimes(1);
    expect(within(document.body).getByText('Planta Warnes')).toBeInTheDocument();
  });
});
