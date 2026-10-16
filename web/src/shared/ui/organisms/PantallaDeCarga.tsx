import { useTranslation } from 'react-i18next';
import logo from '../assets/logo/logo_transparente.png';
import { Spinner } from '../atoms/Spinner';
import { PantallaCompleta } from './PantallaCompleta';
import styles from './PantallaDeCarga.module.css';

/** Mientras se recupera la sesión tras una recarga: el logo y un indicador, nunca el ingreso. */
export function PantallaDeCarga() {
  const { t } = useTranslation('comun');
  return (
    <PantallaCompleta>
      <div className={styles.contenido} role="status" aria-label={t('cargando')}>
        <img src={logo} alt="" className={styles.logo} />
        <Spinner />
      </div>
    </PantallaCompleta>
  );
}
