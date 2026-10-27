import { crearLimitesHttp } from '@/features/limites/api/limitesHttp';
import { FILTROS_INICIALES_DE_CONSUMO } from '@/features/limites/domain/consumo';
import type { ClienteHttp } from '@/shared/api/clienteHttp';

function clienteFalso(respuesta: unknown) {
  const solicitar = vi.fn<(solicitud: unknown) => Promise<unknown>>(() =>
    Promise.resolve(respuesta),
  );
  return { solicitar, cliente: { solicitar } as unknown as ClienteHttp };
}

const CUENTA = { id: '2', codigo: 'FRO', nombre: 'Frigorífico Oriente', estado: 'activa' };

describe('consumo de la bolsa por HTTP (contrato de la API)', () => {
  it('no envía el filtro de estado cuando es "todos" y recorta la búsqueda', async () => {
    const { solicitar, cliente } = clienteFalso({
      datos: [],
      meta: {
        pagina: 1,
        por_pagina: 25,
        total: 0,
        mes: '2026-10',
        desde: '2026-10-01T04:00:00.000Z',
        aviso_porcentaje: 80,
        por_estado: { normal: 0, aviso: 0, superada: 0, sin_tope: 0 },
      },
    });
    await crearLimitesHttp(cliente).listarConsumo({
      ...FILTROS_INICIALES_DE_CONSUMO,
      buscar: '  FRO ',
    });

    expect(solicitar).toHaveBeenCalledWith({
      metodo: 'GET',
      ruta: '/plataforma/consumo-de-bolsa',
      consulta: {
        pagina: 1,
        por_pagina: 25,
        estado: undefined,
        buscar: 'FRO',
        orden: 'porcentaje',
        sentido: 'desc',
      },
    });
  });

  it('mapea el ranking y el mes con su aviso y su conteo por estado', async () => {
    const { cliente } = clienteFalso({
      datos: [
        {
          cuenta: CUENTA,
          plan: '200 usuarios',
          usado: 230,
          tope: 200,
          porcentaje: 115,
          estado: 'superada',
          origen_del_tope: 'excepcion',
          aviso_at: '2026-10-20T14:00:00.000Z',
          superada_at: null,
        },
      ],
      meta: {
        pagina: 1,
        por_pagina: 25,
        total: 1,
        mes: '2026-10',
        desde: '2026-10-01T04:00:00.000Z',
        aviso_porcentaje: 80,
        por_estado: { normal: 0, aviso: 0, superada: 1, sin_tope: 0 },
      },
    });
    const listado = await crearLimitesHttp(cliente).listarConsumo(FILTROS_INICIALES_DE_CONSUMO);

    expect(listado.mes).toBe('2026-10');
    expect(listado.avisoPorcentaje).toBe(80);
    expect(listado.porEstado.superada).toBe(1);
    expect(listado.elementos[0]).toEqual({
      cuenta: { id: '2', codigo: 'FRO', nombre: 'Frigorífico Oriente' },
      plan: '200 usuarios',
      usado: 230,
      tope: 200,
      porcentaje: 115,
      estado: 'superada',
      origenDelTope: 'excepcion',
      avisoEn: new Date('2026-10-20T14:00:00.000Z'),
      superadaEn: null,
    });
  });

  it('el detalle lleva la serie diaria del mes tal como la manda la API', async () => {
    const { solicitar, cliente } = clienteFalso({
      cuenta: CUENTA,
      plan: null,
      usado: 0,
      tope: null,
      porcentaje: null,
      estado: 'sin_tope',
      origen_del_tope: null,
      aviso_at: null,
      superada_at: null,
      mes: '2026-10',
      desde: '2026-10-01T04:00:00.000Z',
      aviso_porcentaje: 80,
      serie: [{ dia: '2026-10-01', generados: 3 }],
    });
    const detalle = await crearLimitesHttp(cliente).consumoDeCuenta('2');

    expect(solicitar).toHaveBeenCalledWith({
      metodo: 'GET',
      ruta: '/plataforma/cuentas/2/consumo-de-bolsa',
    });
    expect(detalle.serie).toEqual([{ dia: '2026-10-01', generados: 3 }]);
    expect(detalle.desde).toEqual(new Date('2026-10-01T04:00:00.000Z'));
  });
});
