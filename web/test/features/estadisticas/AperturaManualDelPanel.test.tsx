import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProveedoresApp } from '@/app/providers/ProveedoresApp';
import type { EstadisticasRepositorio } from '@/features/estadisticas';
import {
  AperturaManualDelPanel,
  RankingsDeAperturaManual,
} from '@/features/estadisticas/ui/AperturaManualDelPanel';
import { porcentajeManual } from '@/features/estadisticas/domain/aperturaManual';
import { APERTURA_MANUAL, crearServiciosDePrueba } from '../../servicios';

function montar(aperturaManual?: EstadisticasRepositorio['aperturaManual'], rankings = false) {
  const servicios = crearServiciosDePrueba(
    aperturaManual ? { estadisticas: { aperturaManual } } : {},
  );
  return render(
    <ProveedoresApp servicios={servicios} reintentos={0}>
      <MemoryRouter>
        {rankings ? <RankingsDeAperturaManual /> : <AperturaManualDelPanel />}
      </MemoryRouter>
    </ProveedoresApp>,
  );
}

describe('apertura desde la app en las estadísticas (HU-21)', () => {
  it('muestra cuántas veces se usó, cuántas no abrieron y el peso frente al QR', async () => {
    montar();
    expect(
      await screen.findByRole('heading', { name: 'Apertura desde la app' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Aperturas', { selector: 'dt' }).nextElementSibling).toHaveTextContent(
      '30',
    );
    // 4 que fallaron + 2 sin confirmación.
    expect(screen.getByText('No se abrieron').nextElementSibling).toHaveTextContent('6');
    // 30 manuales de 100 aperturas en total.
    expect(screen.getByText('Del total de aperturas').nextElementSibling).toHaveTextContent('30 %');
  });

  it('dice cuántas cuentas tienen el modo activo y cuántas puertas lo ofrecen', async () => {
    montar();
    await screen.findByRole('heading', { name: 'Apertura desde la app' });
    expect(screen.getByText('Cuentas con el modo activo').nextElementSibling).toHaveTextContent(
      '4 de 5',
    );
    expect(screen.getByText('Puertas disponibles').nextElementSibling).toHaveTextContent('8 de 12');
  });

  it('el resumen no trae las tablas de puertas y cuentas: van aparte', async () => {
    montar();
    await screen.findByRole('heading', { name: 'Apertura desde la app' });
    expect(screen.queryByRole('region', { name: /Puertas que más usan/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Cuentas que más usan/ })).not.toBeInTheDocument();
  });

  it('lista las puertas y las cuentas que más usan la apertura', async () => {
    montar(undefined, true);
    const puertas = await screen.findByRole('region', {
      name: 'Puertas que más usan la apertura desde la app',
    });
    expect(within(puertas).getByText('Portón principal · Planta Norte')).toBeInTheDocument();
    expect(within(puertas).getByText('Condominio Betania')).toBeInTheDocument();
    const cuentas = screen.getByRole('region', {
      name: 'Cuentas que más usan la apertura desde la app',
    });
    expect(within(cuentas).getByText('Agroindustrial Norte')).toBeInTheDocument();
  });

  it('la gráfica por día tiene su tabla alternativa', async () => {
    montar();
    await screen.findByRole('heading', { name: 'Apertura desde la app' });
    const [botonDeDias] = screen.getAllByRole('button', { name: 'Ver como tabla' });
    expect(botonDeDias).toBeDefined();
    if (botonDeDias) await userEvent.click(botonDeDias);
    expect(screen.getByRole('table', { name: 'Aperturas por día' })).toBeInTheDocument();
  });

  it('sin uso lo dice en vez de mostrar tablas vacías', async () => {
    montar(
      () => Promise.resolve({ ...APERTURA_MANUAL, ordenadas: 0, porPuerta: [], porCuenta: [] }),
      true,
    );
    await screen.findByRole('region', { name: 'Puertas que más usan la apertura desde la app' });
    expect(screen.getAllByText('Todavía nadie abrió una puerta desde la app.')).toHaveLength(2);
  });

  it('si falla la carga muestra el error y deja reintentar', async () => {
    montar(() => Promise.reject(new Error('caído')));
    expect(await screen.findByText('No pudimos cargar las estadísticas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});

describe('porcentaje de aperturas manuales', () => {
  it('es la parte manual del total, redondeada', () => {
    expect(porcentajeManual({ ordenadas: 1, porQr: 2 })).toBe(33);
    expect(porcentajeManual({ ordenadas: 30, porQr: 70 })).toBe(30);
  });

  it('sin aperturas es 0', () => {
    expect(porcentajeManual({ ordenadas: 0, porQr: 0 })).toBe(0);
  });
});
