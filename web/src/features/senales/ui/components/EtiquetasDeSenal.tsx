import { useTranslation } from 'react-i18next';
import { AccesoBadge, type TonoBadge } from '../../../../shared/ui/atoms/AccesoBadge';
import type { NombreIcono } from '../../../../shared/ui/atoms/iconos';
import type { EstadoDeSenal, Gravedad } from '../../domain/senal';

const GRAVEDAD: Readonly<Record<Gravedad, { tono: TonoBadge; icono: NombreIcono }>> = {
  baja: { tono: 'informacion', icono: 'info' },
  media: { tono: 'advertencia', icono: 'warning' },
  alta: { tono: 'peligro', icono: 'error' },
};

const ESTADO: Readonly<Record<EstadoDeSenal, { tono: TonoBadge; icono: NombreIcono }>> = {
  sin_resolver: { tono: 'informacion', icono: 'schedule' },
  pendiente: { tono: 'advertencia', icono: 'pending_actions' },
  confirmado: { tono: 'peligro', icono: 'report' },
  descartado: { tono: 'neutro', icono: 'check' },
};

/** Gravedad con ícono y texto: el color por sí solo no la comunica. */
export function GravedadDeSenal({ gravedad }: { gravedad: Gravedad }) {
  const { t } = useTranslation('senales');
  const { tono, icono } = GRAVEDAD[gravedad];
  return (
    <AccesoBadge tono={tono} icono={icono}>
      {t(`lista.gravedad.${gravedad}`)}
    </AccesoBadge>
  );
}

/** Estado de una señal (sin resolver, pendiente, confirmada o descartada), con ícono y texto. */
export function EstadoDeSenal({ estado }: { estado: EstadoDeSenal }) {
  const { t } = useTranslation('senales');
  const { tono, icono } = ESTADO[estado];
  return (
    <AccesoBadge tono={tono} icono={icono}>
      {t(`lista.estado.${estado}`)}
    </AccesoBadge>
  );
}
