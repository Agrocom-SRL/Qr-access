import { useTranslation } from 'react-i18next';
import { AccesoBadge, type TonoBadge } from '../../../../shared/ui/atoms/AccesoBadge';
import type { NombreIcono } from '../../../../shared/ui/atoms/iconos';
import type { EstadoDeBolsa as Estado } from '../../domain/consumo';

/** Tono e ícono de cada estado; el texto siempre va con ellos (el color no lo dice solo). */
const ESTILO: Readonly<Record<Estado, { tono: TonoBadge; icono: NombreIcono }>> = {
  normal: { tono: 'primario', icono: 'check_circle' },
  aviso: { tono: 'advertencia', icono: 'warning' },
  superada: { tono: 'peligro', icono: 'error' },
  sin_tope: { tono: 'neutro', icono: 'do_not_disturb_on' },
};

/** Estado de la bolsa de una cuenta: `normal`, `aviso`, `superada` o `sin_tope`. */
export function EstadoDeBolsa({ estado }: { estado: Estado }) {
  const { t } = useTranslation('limites');
  const { tono, icono } = ESTILO[estado];
  return (
    <AccesoBadge tono={tono} icono={icono}>
      {t(`estado.${estado}`)}
    </AccesoBadge>
  );
}
