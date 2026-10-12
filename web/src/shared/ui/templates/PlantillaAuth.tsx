import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import foto from '../assets/fotos/ingreso_acceso.jpg';
import logo from '../assets/logo/logo_transparente.png';
import styles from './PlantillaAuth.module.css';

/** A01: mitad hero verde con la marca y mitad formulario de 400 centrado. */
export function PlantillaAuth({ children }: { children: ReactNode }) {
  const { t } = useTranslation('app');
  return (
    <div className={styles.plantilla}>
      <section className={styles.hero}>
        <img src={foto} alt="" className={styles.foto} />
        <img src={logo} alt="" className={styles.logo} />
        <div>
          <p className={styles.nombre}>{t('nombre')}</p>
          <p className={styles.subtitulo}>{t('panel')}</p>
        </div>
      </section>
      <main className={styles.formulario}>
        <div className={styles.contenido}>{children}</div>
      </main>
    </div>
  );
}
