import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '../shared/ui/atoms/Skeleton';
import { EncabezadoPagina } from '../shared/ui/molecules/EncabezadoPagina';
import { BannerSinConexion } from '../shared/ui/organisms/BannerSinConexion';
import { EstadoError } from '../shared/ui/organisms/EstadoError';
import { EstadoVacio } from '../shared/ui/organisms/EstadoVacio';
import {
  PantallaNoEncontrada,
  PantallaSesionVencida,
  PantallaSinConexion,
} from '../shared/ui/organisms/PantallasDeEstado';
import { RUTAS } from './rutas';
import styles from './EstadosPage.module.css';

/** Galería de los estados de PE1 a PE5 (más el 404) para revisarlos sin tener que provocarlos. */
export function EstadosPage() {
  const { t } = useTranslation(['estados', 'comun']);
  const navegar = useNavigate();
  const irAlResumen = () => {
    void navegar(RUTAS.resumen);
  };
  return (
    <>
      <EncabezadoPagina titulo={t('estados:titulo')} subtitulo={t('estados:subtitulo')} />

      <section className={styles.seccion}>
        <h2 className={styles.titulo}>{t('estados:cargando')}</h2>
        <div className={styles.tarjeta} aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} />
          ))}
        </div>
      </section>

      <section className={styles.seccion}>
        <h2 className={styles.titulo}>{t('estados:vacio')}</h2>
        <div className={styles.tarjeta}>
          <EstadoVacio
            titulo={t('estados:ejemploVacioTitulo')}
            texto={t('estados:ejemploVacioTexto')}
          />
        </div>
      </section>

      <section className={styles.seccion}>
        <h2 className={styles.titulo}>{t('estados:error')}</h2>
        <div className={styles.tarjeta}>
          <EstadoError
            titulo={t('estados:ejemploErrorTitulo')}
            code="error.interno"
            onReintentar={irAlResumen}
          />
        </div>
      </section>

      <section className={styles.seccion}>
        <h2 className={styles.titulo}>{t('estados:sinConexion')}</h2>
        <BannerSinConexion hora="14:30" />
      </section>

      <section className={styles.seccion}>
        <h2 className={styles.titulo}>{t('estados:pantallas')}</h2>
        <div className={styles.pantallas}>
          <PantallaSinConexion incrustada onReintentar={irAlResumen} />
          <PantallaSesionVencida incrustada onIngresar={irAlResumen} />
          <PantallaNoEncontrada incrustada onVolver={irAlResumen} />
        </div>
      </section>
    </>
  );
}
