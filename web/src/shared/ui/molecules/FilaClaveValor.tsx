import type { ReactNode } from 'react';
import styles from './FilaClaveValor.module.css';

/** Una fila de `dl`: clave en texto secundario y valor a la derecha. */
export function FilaClaveValor({ clave, children }: { clave: string; children: ReactNode }) {
  return (
    <div className={styles.fila}>
      <dt className={styles.clave}>{clave}</dt>
      <dd className={styles.valor}>{children}</dd>
    </div>
  );
}
