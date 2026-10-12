import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../atoms/Avatar';
import { Icono } from '../atoms/Icono';
import type { NombreIcono } from '../atoms/iconos';
import logo from '../assets/logo/logo_placa.png';
import styles from './RailNavegacion.module.css';

export interface ItemRail {
  /** Clave en el namespace `nav`. */
  clave: string;
  ruta: string;
  icono: NombreIcono;
  /** Variante rellena (`*_fill`) para el ítem activo. */
  iconoActivo: NombreIcono;
}

interface Props {
  items: readonly ItemRail[];
  usuario: { nombre: string; rutaPerfil: string };
}

/**
 * Rail de 240 (≥ 1024) que colapsa a 80 con solo íconos y tooltip (768–1023). El ítem activo es
 * una pastilla `primarioSuave` con ícono relleno, texto 600 y alto 48.
 */
export function RailNavegacion({ items, usuario }: Props) {
  const { t } = useTranslation(['nav', 'app']);
  return (
    <aside className={styles.rail}>
      <div className={styles.marca}>
        <img src={logo} alt="" className={styles.logo} />
        <div className={styles.nombre}>
          <strong>{t('app:nombre')}</strong>
          <span>{t('app:subtitulo')}</span>
        </div>
      </div>
      <nav className={styles.navegacion} aria-label={t('app:nombre')}>
        {items.map((item) => (
          <NavLink
            key={item.ruta}
            to={item.ruta}
            className={styles.item}
            title={t(`nav:${item.clave}`)}
          >
            {({ isActive }) => (
              <>
                <Icono nombre={isActive ? item.iconoActivo : item.icono} />
                <span className={styles.etiqueta}>{t(`nav:${item.clave}`)}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <NavLink to={usuario.rutaPerfil} className={styles.usuario} title={t('nav:perfil')}>
        <Avatar nombre={usuario.nombre} />
        <span className={styles.etiqueta}>
          <strong>{usuario.nombre}</strong>
          <span className={styles.rol}>{t('app:superAdmin')}</span>
        </span>
      </NavLink>
    </aside>
  );
}
