import type { ReactNode } from 'react';
import styles from './BarraDeFiltros.module.css';

/**
 * Fila de filtros de un listado. En pantallas angostas (menos de 600 px) los filtros se apilan
 * en columna: un campo partido a la mitad no se puede usar con el pulgar.
 */
export function BarraDeFiltros({ children, etiqueta }: { children: ReactNode; etiqueta: string }) {
  return (
    <div className={styles.barra} role="group" aria-label={etiqueta}>
      {children}
    </div>
  );
}
