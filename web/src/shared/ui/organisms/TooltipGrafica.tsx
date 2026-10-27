import type { ReactNode } from 'react';
import styles from './TooltipGrafica.module.css';

interface Linea {
  nombre: string;
  /** Variable CSS del color de la serie (la muestra al lado del valor). */
  color: string;
  valor: ReactNode;
}

/** Cuerpo del tooltip de una gráfica: el rótulo y una línea por serie, con su color y su valor. */
export function TooltipGrafica({ titulo, lineas }: { titulo: string; lineas: readonly Linea[] }) {
  return (
    <div className={styles.caja} role="status">
      <p className={styles.titulo}>{titulo}</p>
      {lineas.map((linea) => (
        <p key={linea.nombre} className={styles.linea}>
          <span className={styles.muestra} style={{ background: linea.color }} aria-hidden="true" />
          <span className={styles.nombre}>{linea.nombre}</span>
          <strong className={styles.valor}>{linea.valor}</strong>
        </p>
      ))}
    </div>
  );
}
