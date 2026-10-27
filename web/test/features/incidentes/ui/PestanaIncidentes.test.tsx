import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProveedoresApp } from '@/app/providers/ProveedoresApp';
import type { IncidentesRepositorio } from '@/features/incidentes/api/IncidentesRepositorio';
import { PestanaIncidentes } from '@/features/incidentes/ui/components/PestanaIncidentes';
import { ErrorApi, SUPER_ADMIN, crearServiciosDePrueba } from '../../../servicios';

function montar(incidentes: Partial<IncidentesRepositorio> = {}) {
  const servicios = crearServiciosDePrueba({
    seguridad: {
      restaurar: () =>
        Promise.resolve({
          usuario: SUPER_ADMIN.usuario,
          debeCambiarContrasena: false,
          permisos: ['seguridad.cuenta.ver'],
        }),
    },
    incidentes,
  });
  servicios.almacen.guardar({ acceso: 'a', refresco: 'r' });
  return render(
    <ProveedoresApp servicios={servicios} reintentos={0}>
      <MemoryRouter>
        <PestanaIncidentes cuentaId="7" />
      </MemoryRouter>
    </ProveedoresApp>,
  );
}

describe('incidentes de una cuenta (pestaña de AGROCOM, solo lectura)', () => {
  it('lista cada incidente con su tipo, gravedad y estado escritos, no solo con color', async () => {
    montar();
    const tabla = await screen.findByRole('table', { name: 'Incidentes de la cuenta' });
    expect(within(tabla).getByText('Uso masivo de un QR')).toBeInTheDocument();
    expect(within(tabla).getByText('Media')).toBeInTheDocument();
    expect(within(tabla).getByText('Confirmado')).toBeInTheDocument();
    expect(within(tabla).getByText('Jorge Rivero')).toBeInTheDocument();
    // Sin nombre no inventa uno.
    expect(within(tabla).getByText('Usuario sin nombre')).toBeInTheDocument();
    expect(within(tabla).getByText('Pérdida o robo')).toBeInTheDocument();
  });

  it('el filtro por tipo vuelve a pedir la lista con ese tipo y primera página', async () => {
    const listar = vi.fn<IncidentesRepositorio['listar']>(() =>
      Promise.resolve({ elementos: [], pagina: 1, porPagina: 20, total: 0 }),
    );
    montar({ listar });
    const selector = await screen.findByRole('combobox', { name: 'Tipo' });
    await userEvent.selectOptions(selector, 'perdida_o_robo');
    expect(listar).toHaveBeenLastCalledWith(
      '7',
      expect.objectContaining({ tipo: 'perdida_o_robo', pagina: 1 }),
    );
  });

  it('el detalle muestra la evidencia en cifras y la resolución, sin ningún control para resolver', async () => {
    montar();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Ver el incidente de Jorge Rivero' }),
    );
    const detalle = await screen.findByRole('dialog', { name: 'Incidente de Jorge Rivero' });
    expect(
      within(detalle).getByText('2 QR, 3 intentos de acceso y 0 rechazos de generación'),
    ).toBeInTheDocument();
    expect(within(detalle).getByText('Dos QR a nombre de un mismo Titular')).toBeInTheDocument();
    expect(within(detalle).getByText(/Por Jorge Rivero/)).toBeInTheDocument();
    expect(
      within(detalle).queryByRole('button', { name: /resolver|confirmar|descartar/i }),
    ).toBeNull();
  });

  it('la descripción se muestra como texto plano, nunca como HTML', async () => {
    montar();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Ver el incidente de Usuario sin nombre' }),
    );
    const detalle = await screen.findByRole('dialog', {
      name: 'Incidente de Usuario sin nombre',
    });
    const texto = within(detalle).getByText('<b>Reportado</b> por la portería');
    expect(texto.querySelector('b')).toBeNull();
    expect(within(detalle).getByText('Nadie lo resolvió todavía')).toBeInTheDocument();
  });

  it('un error de la API se muestra traducido por su código', async () => {
    montar({
      listar: () => Promise.reject(new ErrorApi(404, 'cuenta.no_encontrada')),
    });
    expect(await screen.findByText('No encontramos esa cuenta.')).toBeInTheDocument();
  });

  it('sin incidentes, lo dice con un estado vacío', async () => {
    montar({
      listar: () => Promise.resolve({ elementos: [], pagina: 1, porPagina: 20, total: 0 }),
    });
    expect(await screen.findByText('Sin incidentes')).toBeInTheDocument();
  });
});
