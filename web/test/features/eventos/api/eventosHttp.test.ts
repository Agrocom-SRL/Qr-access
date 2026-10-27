import { crearEventosHttp } from '@/features/eventos/api/eventosHttp';
import { FILTROS_DE_EJECUCION, type FiltrosDeEventos } from '@/features/eventos/domain/evento';
import type { ClienteHttp } from '@/shared/api/clienteHttp';

const FILTROS_BASE: FiltrosDeEventos = {
  cuentaId: null,
  resultado: 'todos',
  ejecucion: 'todas',
  desde: '',
  hasta: '',
  pagina: 1,
};

function clienteFalso() {
  const solicitar = vi.fn<(solicitud: unknown) => Promise<unknown>>(() =>
    Promise.resolve({
      datos: [
        {
          id: '55',
          ocurrido_at: '2026-10-27T12:00:00.000Z',
          resultado: 'permitido',
          motivo_code: 'acceso.permitido',
          cuenta: { id: '1', codigo: 'AGR', nombre: 'Agroindustrial Norte' },
          puerta: { id: '3', nombre: 'Portón', sitio: 'Planta Warnes' },
          dispositivo: 'LECT-0042',
          qr_etiqueta: null,
          ejecucion: 'fallida',
          ejecucion_causa: 'puerta_no_abrio',
        },
      ],
      meta: { pagina: 1, por_pagina: 15, total: 1 },
    }),
  );
  return { solicitar, cliente: { solicitar } as unknown as ClienteHttp };
}

describe('lecturas por HTTP: ejecución (ADR 0031 §18)', () => {
  it('sin filtro de ejecución no manda el parámetro', async () => {
    const { solicitar, cliente } = clienteFalso();
    await crearEventosHttp(cliente).listar(FILTROS_BASE, 15);
    const [solicitud] = solicitar.mock.calls[0] as unknown as [
      { consulta: Record<string, unknown> },
    ];
    expect(solicitud.consulta.ejecucion).toBeUndefined();
  });

  it('con un filtro de ejecución lo manda tal cual a la API', async () => {
    const { solicitar, cliente } = clienteFalso();
    await crearEventosHttp(cliente).listar({ ...FILTROS_BASE, ejecucion: 'fallida' }, 15);
    const solicitud = solicitar.mock.calls[0]?.[0] as { consulta: { ejecucion?: string } };
    expect(solicitud.consulta.ejecucion).toBe('fallida');
  });

  it('mapea el desenlace y la causa de cada acceso', async () => {
    const { cliente } = clienteFalso();
    const pagina = await crearEventosHttp(cliente).listar(FILTROS_BASE, 15);
    expect(pagina.elementos[0]).toMatchObject({
      ejecucion: 'fallida',
      ejecucionCausa: 'puerta_no_abrio',
    });
  });

  it('todas las opciones de ejecución son las que acepta la API', () => {
    expect(FILTROS_DE_EJECUCION).toEqual(['todas', 'ejecutada', 'fallida', 'sin_confirmacion']);
  });
});
