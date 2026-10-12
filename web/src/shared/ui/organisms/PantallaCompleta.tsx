import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './PantallaCompleta.module.css';

/** Estado a pantalla completa (PE5b, PE5c, 404); `incrustada` lo recuadra para verlo dentro de otra página. */
export function PantallaCompleta({
  incrustada = false,
  children,
}: {
  incrustada?: boolean;
  children: ReactNode;
}) {
  return <div className={cx(styles.pantalla, incrustada && styles.incrustada)}>{children}</div>;
}
