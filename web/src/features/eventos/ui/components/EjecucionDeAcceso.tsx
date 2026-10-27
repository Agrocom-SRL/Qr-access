import { useTranslation } from 'react-i18next';
import { AccesoBadge, type TonoBadge } from '../../../../shared/ui/atoms/AccesoBadge';
import type { NombreIcono } from '../../../../shared/ui/atoms/iconos';
import type { CausaDeEjecucion, EjecucionDeEvento } from '../../domain/evento';
import styles from './EjecucionDeAcceso.module.css';

/** Tono e ícono de cada desenlace: el texto siempre va con ellos, el color nunca comunica solo. */
const ESTILO: Readonly<Record<EjecucionDeEvento, { tono: TonoBadge; icono: NombreIcono }>> = {
  ejecutada: { tono: 'primario', icono: 'check_circle' },
  fallida: { tono: 'peligro', icono: 'error' },
  sin_confirmacion: { tono: 'advertencia', icono: 'schedule' },
};

interface Props {
  ejecucion: EjecucionDeEvento | null;
  causa: CausaDeEjecucion | null;
}

/** Si la puerta abrió, no abrió o no se sabe (ADR 0031 §18), con la causa cuando la hay. */
export function EjecucionDeAcceso({ ejecucion, causa }: Props) {
  const { t } = useTranslation('eventos');
  if (ejecucion === null) return <span className={styles.suave}>—</span>;
  const { tono, icono } = ESTILO[ejecucion];
  return (
    <span className={styles.apilado}>
      <AccesoBadge tono={tono} icono={icono}>
        {t(`ejecucion.${ejecucion}`)}
      </AccesoBadge>
      {causa === null ? null : <span className={styles.suave}>{t(`ejecucionCausa.${causa}`)}</span>}
    </span>
  );
}
