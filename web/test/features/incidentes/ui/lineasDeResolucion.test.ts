import i18next from 'i18next';
import { lineasDeReincidencia } from '@/features/incidentes/ui/lineasDeResolucion';
import { recursos } from '@/l10n';

const t = i18next.t.bind(i18next);

describe('lo que la resolución dice de la reincidencia', () => {
  it('sin propuesta, dice que todavía no se cruza el umbral', () => {
    expect(
      lineasDeReincidencia(
        t,
        {
          confirmados: 1,
          minimo: 3,
          ventanaDias: 30,
          propuesta: null,
          aplicadaAutomaticamente: false,
        },
        'Jorge Rivero',
      ),
    ).toEqual([
      'Todavía no se cruza el umbral de reincidencia, así que el sistema no propone nada.',
    ]);
  });

  it('con propuesta, dice qué propone, con qué cifras y si ya la aplicó el sistema', () => {
    expect(
      lineasDeReincidencia(
        t,
        {
          confirmados: 3,
          minimo: 3,
          ventanaDias: 30,
          propuesta: 'suspender_y_anular',
          aplicadaAutomaticamente: true,
        },
        'Jorge Rivero',
      ),
    ).toEqual([
      'Propone suspender a Jorge Rivero y anular sus QR vigentes',
      '3 de 3 incidentes confirmados en 30 días',
      'El sistema ya lo restringió de forma automática. Revisa si corresponde.',
    ]);
  });

  it('la propuesta reusa los textos de los avisos, en los tres idiomas', () => {
    for (const idioma of ['es', 'en', 'pt'] as const) {
      expect(recursos[idioma].notificaciones.propuesta.accion.restringir).toContain('{{usuario}}');
    }
  });
});
