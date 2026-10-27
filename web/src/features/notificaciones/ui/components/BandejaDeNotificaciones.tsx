import { useTranslation } from 'react-i18next';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import { ListaDeNotificaciones } from './ListaDeNotificaciones';
import styles from './BandejaDeNotificaciones.module.css';

interface Props {
  puedeGestionar: boolean;
  onCerrar: () => void;
}

/**
 * La bandeja de AGROCOM en diálogo, desde la campana. Su contenido es el mismo que la pantalla completa de
 * avisos (`ListaDeNotificaciones`).
 */
export function BandejaDeNotificaciones({ puedeGestionar, onCerrar }: Props) {
  const { t } = useTranslation('notificaciones');
  return (
    <Dialogo abierto titulo={t('titulo')} onCerrar={onCerrar} ancho="ancho">
      <p className={styles.subtitulo}>{t('subtitulo')}</p>
      <ListaDeNotificaciones puedeGestionar={puedeGestionar} />
    </Dialogo>
  );
}
