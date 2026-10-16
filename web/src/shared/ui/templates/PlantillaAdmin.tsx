import type { ReactNode } from 'react';
import styles from './PlantillaAdmin.module.css';

/** Rail a la izquierda y contenido con padding 32/48 y ancho máximo de 1200. */
export function PlantillaAdmin({ rail, children }: { rail: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.plantilla}>
      {rail}
      <main className={styles.principal}>
        <div className={styles.contenido}>{children}</div>
      </main>
    </div>
  );
}
