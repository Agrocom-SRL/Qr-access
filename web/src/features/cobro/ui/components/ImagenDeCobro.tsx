import { useTranslation } from 'react-i18next';
import { Skeleton } from '../../../../shared/ui/atoms/Skeleton';
import { useImagenDeCobro } from '../../application/useCobro';
import styles from './ImagenDeCobro.module.css';

/** El QR de cobro de una cuenta: se baja con la sesión y se muestra como imagen. */
export function ImagenDeCobro({ imagenId, banco }: { imagenId: string; banco: string }) {
  const { t } = useTranslation('cobro');
  const imagen = useImagenDeCobro(imagenId);
  if (imagen.isError) return <p className={styles.error}>{t('imagenError')}</p>;
  if (imagen.data === undefined) return <Skeleton alto="bloque" />;
  return <img className={styles.imagen} src={imagen.data} alt={t('imagenQr', { banco })} />;
}
