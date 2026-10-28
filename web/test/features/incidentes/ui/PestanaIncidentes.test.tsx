import { elegirOpcion } from '../../../elegirOpcion';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProveedoresApp } from '@/app/providers/ProveedoresApp';
import type { IncidentesRepositorio } from '@/features/incidentes/api/IncidentesRepositorio';
import type { Incidente } from '@/features/incidentes/domain/incidente';
import { PestanaIncidentes } from '@/features/incidentes/ui/components/PestanaIncidentes';
import { ErrorApi, SUPER_ADMIN, crearServiciosDePrueba } from '../../../servicios';

const PERMISO_RESOLVER = 'seguridad.incidente.resolver_cuenta';

/** Un incidente sin nombre y sin resolver: el que se usa para probar la resolución. */
const SIN_RESOLVER: Incidente = {
  id: '902',
  usuario: { id: '32', etiqueta: null },
  tipo: 'perdida_o_robo',
  gravedad: 'alta',
  origen: 'persona',
  registradoPor: { id: '1', etiqueta: 'Lucía Paz' },
  descripcion: null,
  evidencia: { qrIds: ['13'], eventoAccesoIds: [], eventoLimiteIds: [] },
  estado: 'sin_resolver',
  resolucion: null,
  ocurridoEn: new Date('2026-10-27T09:00:00Z'),
  creadoEn: new Date('2026-10-27T09:10:00Z'),
};

function montar(
  incidentes: Partial<IncidentesRepositorio> = {},
  permisos: readonly string[] = ['seguridad.cuenta.ver'],
) {
  const servicios = crearServiciosDePrueba({
    seguridad: {
      restaurar: () =>
        Promise.resolve({
          usuario: SUPER_ADMIN.usuario,
          debeCambiarContrasena: false,
          permisos: [...permisos],
        }),
    },
    incidentes,
  });
  servicios.almacen.guardar('a');
  return render(
    <ProveedoresApp servicios={servicios} reintentos={0}>
      <MemoryRouter>
        <PestanaIncidentes cuentaId="7" />
      </MemoryRouter>
    </ProveedoresApp>,
  );
}

/** Abre el detalle del incidente sin resolver de una lista de un solo incidente. */
async function abrirSinResolver(incidentes: Partial<IncidentesRepositorio> = {}) {
  montar(
    {
      listar: () =>
        Promise.resolve({ elementos: [SIN_RESOLVER], pagina: 1, porPagina: 20, total: 1 }),
      ...incidentes,
    },
    [PERMISO_RESOLVER],
  );
  await userEvent.click(
    await screen.findByRole('button', { name: 'Ver el incidente de Usuario sin nombre' }),
  );
  return screen.findByRole('dialog', { name: 'Incidente de Usuario sin nombre' });
}

describe('incidentes de una cuenta (pestaña de AGROCOM)', () => {
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
    await elegirOpcion(selector, 'Pérdida o robo');
    expect(listar).toHaveBeenLastCalledWith(
      '7',
      expect.objectContaining({ tipo: 'perdida_o_robo', pagina: 1 }),
    );
  });

  it('el detalle muestra la evidencia en cifras y la resolución', async () => {
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
  });

  it('sin el permiso de resolver, el detalle solo se consulta y no ofrece ningún control para resolver', async () => {
    montar();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Ver el incidente de Jorge Rivero' }),
    );
    const detalle = await screen.findByRole('dialog', { name: 'Incidente de Jorge Rivero' });
    expect(
      within(detalle).getByText(/resolver incidentes requiere un permiso/),
    ).toBeInTheDocument();
    expect(
      within(detalle).queryByRole('button', { name: /resolver|confirmar|descartar|pendiente/i }),
    ).toBeNull();
    expect(within(detalle).queryByRole('textbox', { name: 'Motivo' })).toBeNull();
  });

  it('la descripción se muestra como texto plano, nunca como HTML', async () => {
    montar({
      listar: () =>
        Promise.resolve({
          elementos: [
            {
              ...SIN_RESOLVER,
              descripcion: '<b>Reportado</b> por la portería',
            },
          ],
          pagina: 1,
          porPagina: 20,
          total: 1,
        }),
    });
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

describe('resolver un incidente de una cuenta (permiso de AGROCOM)', () => {
  it('confirmar sin motivo pide el motivo y no llama a la API', async () => {
    const resolver = vi.fn<IncidentesRepositorio['resolver']>();
    const detalle = await abrirSinResolver({ resolver });
    await userEvent.click(within(detalle).getByRole('button', { name: 'Confirmar' }));
    expect(
      within(detalle).getByText('Escribe el motivo para confirmar el incidente.'),
    ).toBeInTheDocument();
    expect(resolver).not.toHaveBeenCalled();
  });

  it('descartar no pide motivo y muestra el estado guardado', async () => {
    const resolver = vi.fn<IncidentesRepositorio['resolver']>(() =>
      Promise.resolve({
        incidente: {
          ...SIN_RESOLVER,
          estado: 'descartado',
          resolucion: {
            resultado: 'descartado',
            motivo: null,
            resueltoPor: { id: '1', etiqueta: 'Lucía Paz' },
            resueltaEn: new Date('2026-10-27T10:00:00Z'),
          },
        },
        reincidencia: null,
      }),
    );
    const detalle = await abrirSinResolver({ resolver });
    await userEvent.click(within(detalle).getByRole('button', { name: 'Descartar' }));
    expect(resolver).toHaveBeenCalledWith('7', '902', { resultado: 'descartado' });
    expect(await within(detalle).findByText('Quedó guardado como Descartado.')).toBeInTheDocument();
  });

  it('confirmar con motivo lo manda y muestra la propuesta de reincidencia, sin aplicarla', async () => {
    const resolver = vi.fn<IncidentesRepositorio['resolver']>(() =>
      Promise.resolve({
        incidente: { ...SIN_RESOLVER, estado: 'confirmado' },
        reincidencia: {
          confirmados: 2,
          minimo: 3,
          ventanaDias: 30,
          propuesta: 'restringir',
          aplicadaAutomaticamente: false,
        },
      }),
    );
    const detalle = await abrirSinResolver({ resolver });
    await userEvent.type(
      within(detalle).getByRole('textbox', { name: 'Motivo' }),
      'Denuncia de la portería',
    );
    await userEvent.click(within(detalle).getByRole('button', { name: 'Confirmar' }));

    expect(resolver).toHaveBeenCalledWith('7', '902', {
      resultado: 'confirmado',
      motivo: 'Denuncia de la portería',
    });
    expect(
      await within(detalle).findByText('Propone restringir a este usuario'),
    ).toBeInTheDocument();
    expect(
      within(detalle).getByText('2 de 3 incidentes confirmados en 30 días'),
    ).toBeInTheDocument();
    expect(
      within(detalle).getByText('Nadie la aplicó todavía: la decide una persona de la cuenta.'),
    ).toBeInTheDocument();
  });

  it('un error de la API al resolver se muestra traducido y el diálogo sigue abierto', async () => {
    const resolver = vi.fn<IncidentesRepositorio['resolver']>(() =>
      Promise.reject(new ErrorApi(404, 'incidente.no_encontrado')),
    );
    const detalle = await abrirSinResolver({ resolver });
    await userEvent.click(within(detalle).getByRole('button', { name: 'Descartar' }));
    expect(await within(detalle).findByText('No encontramos ese incidente.')).toBeInTheDocument();
    expect(detalle).toBeInTheDocument();
  });
});
