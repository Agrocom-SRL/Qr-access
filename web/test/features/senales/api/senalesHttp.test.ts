import { crearSenalesHttp } from '@/features/senales/api/senalesHttp';
import { FILTROS_INICIALES_DE_FLUJO } from '@/features/senales/domain/flujo';
import { FILTROS_INICIALES_DE_SENALES } from '@/features/senales/domain/senal';
import type { ClienteHttp } from '@/shared/api/clienteHttp';

function clienteFalso(respuesta: unknown) {
  const solicitar = vi.fn<(solicitud: unknown) => Promise<unknown>>(() =>
    Promise.resolve(respuesta),
  );
  return { solicitar, cliente: { solicitar } as unknown as ClienteHttp };
}

describe('señales y flujo por HTTP (contrato de la API)', () => {
  it('pasa el día del filtro como instante de La Paz y su "hasta" como límite exclusivo', async () => {
    const { solicitar, cliente } = clienteFalso({
      datos: [],
      meta: { pagina: 1, por_pagina: 20, total: 0 },
    });
    await crearSenalesHttp(cliente).listarSenales({
      ...FILTROS_INICIALES_DE_SENALES,
      estado: 'todas',
      tipo: 'uso_masivo',
      desde: '2026-10-01',
      hasta: '2026-10-02',
    });

    expect(solicitar).toHaveBeenCalledWith({
      metodo: 'GET',
      ruta: '/plataforma/senales',
      consulta: expect.objectContaining({
        tipo: 'uso_masivo',
        estado: undefined,
        desde: '2026-10-01T00:00:00-04:00',
        hasta: '2026-10-03T04:00:00.000Z',
      }) as unknown,
    });
  });

  it('el filtro "abiertas" se envía tal cual: la API lo conoce', async () => {
    const { solicitar, cliente } = clienteFalso({
      datos: [],
      meta: { pagina: 1, por_pagina: 20, total: 0 },
    });
    await crearSenalesHttp(cliente).listarSenales(FILTROS_INICIALES_DE_SENALES);
    expect(solicitar).toHaveBeenCalledWith(
      expect.objectContaining({
        consulta: expect.objectContaining({ estado: 'abiertas' }) as unknown,
      }),
    );
  });

  it('el flujo manda solo_atipicas como texto y la búsqueda sin espacios', async () => {
    const { solicitar, cliente } = clienteFalso({
      datos: [],
      meta: { pagina: 1, por_pagina: 15, total: 0, dias: 7, hoy: '2026-10-27' },
    });
    await crearSenalesHttp(cliente).listarFlujo({
      ...FILTROS_INICIALES_DE_FLUJO,
      soloAtipicas: true,
      buscar: ' AGR ',
    });
    expect(solicitar).toHaveBeenCalledWith(
      expect.objectContaining({
        consulta: expect.objectContaining({
          solo_atipicas: true,
          buscar: 'AGR',
          dias: 7,
        }) as unknown,
      }),
    );
  });

  it('mapea el detalle de flujo con su marca de día atípico y la base', async () => {
    const { cliente } = clienteFalso({
      cuenta: { id: '1', codigo: 'AGR', nombre: 'Agroindustrial Norte', estado: 'activa' },
      usuarios_activos: 2,
      umbrales: { aperturas_minimo: 50, aperturas_por_usuario: 25 },
      zona_horaria: 'America/La_Paz',
      serie: [
        {
          dia: '2026-10-27',
          aperturas: 60,
          rechazos: 2,
          generados: 40,
          por_usuario: 30,
          atipico: true,
          base: 12.5,
          veces_la_base: 4.8,
        },
      ],
    });
    const detalle = await crearSenalesHttp(cliente).flujoDeCuenta('1', 7);

    expect(detalle.serie[0]).toEqual({
      dia: '2026-10-27',
      aperturas: 60,
      rechazos: 2,
      generados: 40,
      porUsuario: 30,
      atipico: true,
      base: 12.5,
      vecesLaBase: 4.8,
    });
    expect(detalle.umbrales).toEqual({ aperturasMinimo: 50, aperturasPorUsuario: 25 });
  });

  it('las cuentas para el filtro salen del flujo, sin pedir el permiso de cuentas', async () => {
    const { solicitar, cliente } = clienteFalso({
      datos: [
        {
          cuenta: { id: '1', codigo: 'AGR', nombre: 'Agroindustrial Norte', estado: 'activa' },
          usuarios_activos: 0,
          umbrales: { aperturas_minimo: 50, aperturas_por_usuario: 25 },
          aperturas_hoy: 0,
          por_usuario_hoy: 0,
          atipica_hoy: false,
          aperturas_periodo: 0,
          dias_atipicos: 0,
          ultimo_dia_atipico: null,
          base: null,
        },
      ],
      meta: { pagina: 1, por_pagina: 100, total: 1, dias: 7, hoy: '2026-10-27' },
    });
    const cuentas = await crearSenalesHttp(cliente).opcionesDeCuenta();

    expect(solicitar).toHaveBeenCalledWith(
      expect.objectContaining({ ruta: '/plataforma/flujo-de-cuentas' }),
    );
    expect(cuentas).toEqual([{ id: '1', codigo: 'AGR', nombre: 'Agroindustrial Norte' }]);
  });
});
