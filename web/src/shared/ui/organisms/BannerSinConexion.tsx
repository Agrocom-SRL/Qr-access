import { useTranslation } from 'react-i18next';
import { Aviso } from '../molecules/Aviso';

/** Banner de advertencia con la hora de los datos en caché (PE5a). */
export function BannerSinConexion({ hora }: { hora?: string }) {
  const { t } = useTranslation('comun');
  return <Aviso tono="advertencia">{t('sinConexion', { hora: hora ?? '' })}</Aviso>;
}
