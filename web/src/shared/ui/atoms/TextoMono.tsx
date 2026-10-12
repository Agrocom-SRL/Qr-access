import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './TextoMono.module.css';

/** Códigos de cuenta, cifras, montos, fechas y PIN: IBM Plex Mono con cifras tabulares. */
export function TextoMono({ children, fuerte = false }: { children: ReactNode; fuerte?: boolean }) {
  return <span className={cx(styles.mono, fuerte && styles.fuerte)}>{children}</span>;
}
