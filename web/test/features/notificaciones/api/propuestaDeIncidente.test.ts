import {
  crearNotificacionesHttp,
  notificacionDesdeDto,
} from '@/features/notificaciones/api/notificacionesHttp';
import type { ClienteHttp, SolicitudHttp } from '@/shared/api/clienteHttp';

function clienteFalso(respuesta?: unknown) {
  const solicitar = vi.fn<(solicitud: SolicitudHttp) => Promise<unknown>>(() =>
    Promise.resolve(respuesta),
  );
  return { solicitar, cliente: { solicitar } as unknown as ClienteHttp };
}

/** Un aviso `incidente.propuesta` tal como lo manda la API (ADR 0033 §4.3, ola W11). */
const DTO_PROPUESTA: Parameters<typeof notificacionDesdeDto>[0] = {
  id: '910',
  tipo: 'incidente.propuesta',
  severidad: 'aviso',
  cuenta_id: '1',
  resuelta: false,
  leida: false,
  datos: {
    cuenta: { id: '1', codigo: 'AGR', nombre: 'Agroindustrial Norte' },
    sitio: null,
    placas: [],
    propuesta: {
      accion: 'restringir',
      usuario_id: '31',
      usuario_etiqueta: 'Jorge Rivero',
      incidente_id: '901',
      incidente_tipo: 'uso_masivo',
      confirmados: 3,
      minimo: 3,
      ventana_dias: 30,
      aplicada_automaticamente: false,
    },
  },
  novedad_at: '2026-10-27T12:00:00.000Z',
  creada_at: '2026-10-27T11:00:00.000Z',
};

describe('propuesta de incidente en la bandeja de AGROCOM', () => {
  it('mapea la propuesta con sus cifras y su usuario, sin tokens ni IP', () => {
    const aviso = notificacionDesdeDto(DTO_PROPUESTA);
    expect(aviso.tipo).toBe('incidente.propuesta');
    expect(aviso.propuesta).toEqual({
      accion: 'restringir',
      usuarioId: '31',
      usuarioEtiqueta: 'Jorge Rivero',
      incidenteId: '901',
      incidenteTipo: 'uso_masivo',
      confirmados: 3,
      minimo: 3,
      ventanaDias: 30,
      aplicadaAutomaticamente: false,
    });
  });

  it('un aviso que no es propuesta no trae el campo', () => {
    const aviso = notificacionDesdeDto({
      ...DTO_PROPUESTA,
      tipo: 'apertura.fallida',
      datos: { ...DTO_PROPUESTA.datos, propuesta: undefined },
    });
    expect(aviso.propuesta).toBeUndefined();
  });

  it('el filtro por tipo viaja a la API; sin tipo, no se manda', async () => {
    const { solicitar, cliente } = clienteFalso({
      datos: [DTO_PROPUESTA],
      meta: { pagina: 1, por_pagina: 10, total: 1 },
    });
    const repositorio = crearNotificacionesHttp(cliente);
    await repositorio.listar('todas', 1, 'incidente.propuesta');
    const primera = solicitar.mock.calls[0]?.[0];
    expect(primera?.ruta).toBe('/plataforma/notificaciones');
    expect(primera?.consulta).toMatchObject({ tipo: 'incidente.propuesta', estado: 'todas' });
    await repositorio.listar('no_leidas', 2);
    const ultima = solicitar.mock.calls.at(-1)?.[0];
    expect(ultima?.consulta?.tipo).toBeUndefined();
  });
});
