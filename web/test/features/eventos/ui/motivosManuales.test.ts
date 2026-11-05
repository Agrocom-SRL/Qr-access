import i18next from 'i18next';
import { cambiarIdioma } from '@/l10n';

/** Los motivos que guarda la API para la apertura manual (ADR 0035); se traducen por su código. */
const MOTIVOS_MANUALES = [
  'manual_ordenada',
  'manual_usuario_restringido',
  'manual_usuario_suspendido',
  'manual_cuenta_suspendida',
  'manual_usuario_eliminado',
  'manual_suscripcion_vencida',
  'manual_no_habilitada',
  'manual_sin_dispositivo',
  'manual_sin_conexion',
  'manual_orden_en_curso',
  'manual_limite',
] as const;

describe('lecturas: textos de la apertura manual', () => {
  afterEach(async () => {
    await cambiarIdioma('es');
  });

  it.each(['es', 'en', 'pt'] as const)('cada motivo manual tiene texto en %s', async (idioma) => {
    await cambiarIdioma(idioma);
    for (const motivo of MOTIVOS_MANUALES) {
      const texto = i18next.t(`eventos:motivo.${motivo}`, { defaultValue: '' });
      expect(texto, `${idioma} ${motivo}`).not.toBe('');
      expect(texto, `${idioma} ${motivo}`).not.toBe(i18next.t('eventos:motivo.desconocido'));
    }
  });

  it('traduce el motivo de un rechazo manual en español', async () => {
    await cambiarIdioma('es');
    expect(i18next.t('eventos:motivo.manual_no_habilitada')).toBe(
      'La puerta no tiene la apertura manual encendida',
    );
    expect(i18next.t('eventos:metodo.manual')).toBe('Apertura manual');
  });
});
