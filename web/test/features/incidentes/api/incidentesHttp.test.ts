import { crearIncidentesHttp, incidenteDesdeDto } from '@/features/incidentes/api/incidentesHttp';
import { FILTROS_INICIALES_DE_INCIDENTES } from '@/features/incidentes/domain/incidente';
import type { ClienteHttp, SolicitudHttp } from '@/shared/api/clienteHttp';

function clienteFalso(respuesta?: unknown) {
  const solicitar = vi.fn<(solicitud: SolicitudHttp) => Promise<unknown>>(() =>
    Promise.resolve(respuesta),
  );
  return { solicitar, cliente: { solicitar } as unknown as ClienteHttp };
}

const DTO = {
  id: '901',
  usuario: { id: '31', etiqueta: 'Jorge Rivero' },
  tipo: 'uso_masivo' as const,
  gravedad: 'media' as const,
  origen: 'sistema' as const,
  registrado_por: null,
  descripcion: null,
  evidencia: { qr_ids: ['11'], evento_acceso_ids: ['70', '71'], evento_limite_ids: [] },
  estado: 'confirmado' as const,
  resolucion: {
    resultado: 'confirmado' as const,
    motivo: 'Confirmado tras revisar',
    resuelto_por: { id: '1', etiqueta: 'Lucía Paz' },
    resuelta_at: '2026-10-26T15:00:00.000Z',
  },
  ocurrido_at: '2026-10-26T14:00:00.000Z',
  created_at: '2026-10-26T14:01:00.000Z',
};

describe('incidentes de una cuenta por HTTP (ADR 0033 §4, solo lectura)', () => {
  it('mapea el incidente con su evidencia en ids y su resolución', () => {
    const incidente = incidenteDesdeDto(DTO);
    expect(incidente.evidencia).toEqual({
      qrIds: ['11'],
      eventoAccesoIds: ['70', '71'],
      eventoLimiteIds: [],
    });
    expect(incidente.resolucion).toMatchObject({
      resultado: 'confirmado',
      motivo: 'Confirmado tras revisar',
      resueltoPor: { id: '1', etiqueta: 'Lucía Paz' },
    });
    expect(incidente.resolucion?.resueltaEn).toEqual(new Date('2026-10-26T15:00:00.000Z'));
    expect(incidente.registradoPor).toBeNull();
  });

  it('pide la lista de la cuenta en su ruta de plataforma, sin mandar los filtros en «todos»', async () => {
    const { solicitar, cliente } = clienteFalso({
      datos: [DTO],
      meta: { pagina: 1, por_pagina: 20, total: 1 },
    });
    const resultado = await crearIncidentesHttp(cliente).listar(
      '7',
      FILTROS_INICIALES_DE_INCIDENTES,
    );
    expect(resultado.elementos).toHaveLength(1);
    const solicitud = solicitar.mock.calls[0]?.[0];
    expect(solicitud?.ruta).toBe('/plataforma/cuentas/7/incidentes');
    expect(solicitud?.consulta).toEqual({
      pagina: 1,
      por_pagina: 20,
      tipo: undefined,
      origen: undefined,
      estado: undefined,
    });
  });

  it('manda el tipo, el origen y el estado elegidos', async () => {
    const { solicitar, cliente } = clienteFalso({
      datos: [],
      meta: { pagina: 2, por_pagina: 20, total: 0 },
    });
    await crearIncidentesHttp(cliente).listar('7', {
      tipo: 'perdida_o_robo',
      origen: 'persona',
      estado: 'sin_resolver',
      pagina: 2,
    });
    expect(solicitar.mock.calls[0]?.[0].consulta).toMatchObject({
      pagina: 2,
      tipo: 'perdida_o_robo',
      origen: 'persona',
      estado: 'sin_resolver',
    });
  });

  it('resolver manda el resultado y el motivo a la resolución de la cuenta, y devuelve la reincidencia', async () => {
    const { solicitar, cliente } = clienteFalso({
      incidente: DTO,
      reincidencia: {
        confirmados: 2,
        minimo: 3,
        ventana_dias: 30,
        propuesta: 'restringir',
        aplicada_automaticamente: false,
      },
    });
    const respuesta = await crearIncidentesHttp(cliente).resolver('7', '901', {
      resultado: 'confirmado',
      motivo: 'Dos QR a nombre de un mismo Titular',
    });
    expect(solicitar).toHaveBeenCalledWith({
      metodo: 'POST',
      ruta: '/plataforma/cuentas/7/incidentes/901/resolucion',
      cuerpo: { resultado: 'confirmado', motivo: 'Dos QR a nombre de un mismo Titular' },
    });
    expect(respuesta.incidente.estado).toBe('confirmado');
    expect(respuesta.reincidencia).toEqual({
      confirmados: 2,
      minimo: 3,
      ventanaDias: 30,
      propuesta: 'restringir',
      aplicadaAutomaticamente: false,
    });
  });

  it('sin reincidencia evaluada (repetir el resultado) la devuelve en null', async () => {
    const { cliente } = clienteFalso({ incidente: DTO, reincidencia: null });
    const respuesta = await crearIncidentesHttp(cliente).resolver('7', '901', {
      resultado: 'descartado',
    });
    expect(respuesta.reincidencia).toBeNull();
  });
});
