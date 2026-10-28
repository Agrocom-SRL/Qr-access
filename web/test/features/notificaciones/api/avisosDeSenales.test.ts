import { crearNotificacionesHttp } from '@/features/notificaciones/api/notificacionesHttp';
import type { ClienteHttp } from '@/shared/api/clienteHttp';

function avisoDe(tipo: string, datos: Record<string, unknown>) {
  return {
    id: '300',
    tipo,
    severidad: 'aviso',
    cuenta_id: '1',
    resuelta: false,
    leida: false,
    datos: {
      cuenta: { id: '1', codigo: 'AGR', nombre: 'Agroindustrial Norte' },
      sitio: null,
      placas: [],
      ...datos,
    },
    novedad_at: '2026-10-27T12:00:00.000Z',
    creada_at: '2026-10-27T11:00:00.000Z',
  };
}

function listarCon(aviso: unknown) {
  const cliente = {
    solicitar: vi.fn(() =>
      Promise.resolve({ datos: [aviso], meta: { pagina: 1, por_pagina: 10, total: 1 } }),
    ),
  } as unknown as ClienteHttp;
  return crearNotificacionesHttp(cliente).listar('todas', 1);
}

describe('avisos de señales, bolsa y flujo por HTTP', () => {
  it('un aviso de señal de uso trae su usuario, su medida y su día', async () => {
    const pagina = await listarCon(
      avisoDe('senal.uso', {
        senal: {
          tipo: 'uso_masivo',
          usuario_id: '31',
          usuario_etiqueta: 'Jorge Rivero',
          gravedad: 'media',
          incidente_id: '901',
          dia: '2026-10-27',
          valor: 13,
          umbral: 12,
        },
      }),
    );
    const [aviso] = pagina.elementos;
    expect(aviso?.tipo).toBe('senal.uso');
    expect(aviso?.senal).toEqual({
      tipo: 'uso_masivo',
      usuarioId: '31',
      usuarioEtiqueta: 'Jorge Rivero',
      gravedad: 'media',
      incidenteId: '901',
      dia: '2026-10-27',
      valor: 13,
      umbral: 12,
    });
    expect(aviso?.bolsa).toBeUndefined();
  });

  it('una bolsa superada trae el mes y las cifras, que pueden faltar', async () => {
    const pagina = await listarCon(
      avisoDe('bolsa.superada', {
        bolsa: { mes: '2026-10', dia: '2026-10-27', usado: null, tope: null },
      }),
    );
    expect(pagina.elementos[0]?.bolsa).toEqual({
      mes: '2026-10',
      dia: '2026-10-27',
      usado: null,
      tope: null,
    });
  });

  it('un flujo atípico trae las aperturas, los usuarios y la base', async () => {
    const pagina = await listarCon(
      avisoDe('flujo.atipico', {
        flujo: {
          dia: '2026-10-27',
          aperturas: 60,
          usuarios_activos: 2,
          por_usuario: 30,
          umbral_por_usuario: 25,
          base: 12.5,
        },
      }),
    );
    expect(pagina.elementos[0]?.flujo).toEqual({
      dia: '2026-10-27',
      aperturas: 60,
      usuariosActivos: 2,
      porUsuario: 30,
      umbralPorUsuario: 25,
      base: 12.5,
    });
  });
});
