import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import styles from './Migas.module.css';

export interface Miga {
  etiqueta: string;
  /** Sin ruta = la página actual. */
  ruta?: string;
}

/** Ruta de navegación sobre el título: `Cuentas / Crear cuenta · Agrícola Guarayos · AGU`. */
export function Migas({ migas }: { migas: readonly Miga[] }) {
  const { t } = useTranslation('app');
  return (
    <nav aria-label={t('migas')} className={styles.migas}>
      {migas.map((miga, i) => (
        <span key={`${miga.etiqueta}-${String(i)}`}>
          {i > 0 ? ' / ' : null}
          {miga.ruta ? (
            <Link to={miga.ruta} className={styles.enlace}>
              {miga.etiqueta}
            </Link>
          ) : (
            miga.etiqueta
          )}
        </span>
      ))}
    </nav>
  );
}
