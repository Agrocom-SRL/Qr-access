import { cx } from '../../lib/cx';
import styles from './Skeleton.module.css';

interface Props {
  /** Ancho como fracción (0–1) del contenedor; por defecto todo. */
  ancho?: 'completo' | 'largo' | 'medio' | 'corto';
  alto?: 'texto' | 'bloque';
}

/** Marcador de carga: pulso de opacidad de 1200 ms, estático con movimiento reducido. */
export function Skeleton({ ancho = 'completo', alto = 'texto' }: Props) {
  return <span className={cx(styles.skeleton, styles[ancho], styles[alto])} aria-hidden="true" />;
}
