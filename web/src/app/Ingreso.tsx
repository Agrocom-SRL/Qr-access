import { t } from '../l10n';
import { AccesoBoton } from '../shared/componentes/AccesoBoton';
import styles from './Ingreso.module.css';

/** Esqueleto de la pantalla de ingreso: se completa con el handoff de diseño. */
export function Ingreso() {
  return (
    <main className={styles.pagina}>
      <form
        className={styles.tarjeta}
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <h1 className={styles.titulo}>{t.appTitulo}</h1>
        <p className={styles.subtitulo}>{t.appSubtitulo}</p>
        <label className={styles.campo}>
          {t.ingresoUsuario}
          <input name="usuario" autoComplete="username" />
        </label>
        <label className={styles.campo}>
          {t.ingresoContrasena}
          <input name="contrasena" type="password" autoComplete="current-password" />
        </label>
        <AccesoBoton type="submit">{t.ingresoBoton}</AccesoBoton>
      </form>
    </main>
  );
}
