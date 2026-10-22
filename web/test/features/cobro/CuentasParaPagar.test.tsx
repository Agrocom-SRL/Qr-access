import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProveedoresApp } from '@/app/providers/ProveedoresApp';
import { CuentasParaPagar } from '@/features/cobro';
import { CUENTAS_DE_COBRO, crearServiciosDePrueba } from '../../servicios';

function montar(metodo: 'transferencia' | 'qr', servicios = crearServiciosDePrueba()) {
  return render(
    <ProveedoresApp servicios={servicios} reintentos={0}>
      <MemoryRouter>
        <CuentasParaPagar metodo={metodo} />
      </MemoryRouter>
    </ProveedoresApp>,
  );
}

describe('CuentasParaPagar', () => {
  it('con transferencia muestra las cuentas bancarias activas, no los QR', async () => {
    montar('transferencia');
    expect(await screen.findByText('10000123456')).toBeInTheDocument();
    expect(screen.queryByText('Banco Mercantil Santa Cruz')).toBeNull();
  });

  it('con QR muestra los QR activos', async () => {
    montar('qr');
    expect(
      await screen.findByRole('article', { name: 'Banco Mercantil Santa Cruz' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('10000123456')).toBeNull();
  });

  it('no muestra las cuentas desactivadas y avisa cuando no queda ninguna', async () => {
    const inactivas = CUENTAS_DE_COBRO.map((c) => ({ ...c, activo: false }));
    montar(
      'transferencia',
      crearServiciosDePrueba({ cobro: { listar: () => Promise.resolve(inactivas) } }),
    );
    expect(await screen.findByText(/No hay cuentas bancarias activas/)).toBeInTheDocument();
  });

  it('si la lista no carga, no muestra nada (el pago no depende de esta ayuda)', async () => {
    const { container } = montar(
      'qr',
      crearServiciosDePrueba({ cobro: { listar: () => Promise.reject(new Error('sin permiso')) } }),
    );
    await new Promise((resolver) => setTimeout(resolver, 50));
    expect(container).toBeEmptyDOMElement();
  });
});
