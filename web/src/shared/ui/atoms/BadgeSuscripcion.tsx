import { useTranslation } from 'react-i18next';
import { AccesoBadge, type TonoBadge } from './AccesoBadge';
import type { NombreIcono } from './iconos';

/** Estados que pinta el badge; el cálculo del estado vive en `features/suscripciones/domain`. */
export type EstadoBadgeSuscripcion = 'activa' | 'porVencer' | 'vencida' | 'suspendida';

/** theme.ts › badgeSuscripcion: cada estado con su tono e ícono. */
const APARIENCIA: Readonly<
  Record<EstadoBadgeSuscripcion, { tono: TonoBadge; icono: NombreIcono }>
> = {
  activa: { tono: 'primario', icono: 'check_circle' },
  porVencer: { tono: 'advertencia', icono: 'schedule' },
  vencida: { tono: 'peligro', icono: 'event_busy' },
  suspendida: { tono: 'neutro', icono: 'pause_circle' },
};

export function BadgeSuscripcion({ estado }: { estado: EstadoBadgeSuscripcion }) {
  const { t } = useTranslation('suscripcion');
  const { tono, icono } = APARIENCIA[estado];
  return (
    <AccesoBadge tono={tono} icono={icono}>
      {t(`estado.${estado}`)}
    </AccesoBadge>
  );
}
