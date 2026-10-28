import type { TFunction } from 'i18next';
import { formatearNumero } from '../../../l10n/formatos';
import type { ReincidenciaDeResolucion } from '../domain/incidente';

/**
 * Las líneas que cuentan lo que la resolución dejó de reincidencia (ADR 0033 §4.3). El sistema NO aplica nada:
 * propone. Los textos de la propuesta son los mismos de los avisos (`notificaciones:propuesta`), para que la
 * persona lea lo mismo en la bandeja y aquí. Cada cifra sale de la API; no se inventa ninguna.
 */
export function lineasDeReincidencia(
  t: TFunction,
  reincidencia: ReincidenciaDeResolucion,
  usuario: string,
): string[] {
  if (reincidencia.propuesta === null) return [t('incidentes:resolucion.sinPropuesta')];
  return [
    t(`notificaciones:propuesta.accion.${reincidencia.propuesta}`, { usuario }),
    t('notificaciones:propuesta.incidentes', {
      confirmados: formatearNumero(reincidencia.confirmados),
      minimo: formatearNumero(reincidencia.minimo),
      ventana: formatearNumero(reincidencia.ventanaDias),
    }),
    reincidencia.aplicadaAutomaticamente
      ? t('notificaciones:propuesta.aplicada')
      : t('notificaciones:propuesta.pendiente'),
  ];
}
