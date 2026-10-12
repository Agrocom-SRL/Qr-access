import { useTranslation } from 'react-i18next';
import { AccesoBoton } from '../shared/componentes/AccesoBoton';
import styles from './Ingreso.module.css';

/** Esqueleto de la pantalla de ingreso: se completa con el handoff de diseño. */
export function Ingreso() {
  const { t } = useTranslation(['auth', 'app']);
  return (
    <main className={styles.pagina}>
      <form
        className={styles.tarjeta}
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <h1 className={styles.titulo}>{t('app:nombre')}</h1>
        <p className={styles.subtitulo}>{t('app:subtitulo')}</p>
        <label className={styles.campo}>
          {t('auth:usuario')}
          <input name="usuario" autoComplete="username" />
        </label>
        <label className={styles.campo}>
          {t('auth:contrasena')}
          <input name="contrasena" type="password" autoComplete="current-password" />
        </label>
        <AccesoBoton type="submit">{t('auth:ingresar')}</AccesoBoton>
      </form>
    </main>
  );
}
