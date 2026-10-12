import styles from './Spinner.module.css';

/** Indicador de carga de 18 px; con movimiento reducido gira en 0 ms y queda estático. */
export function Spinner() {
  return <span className={styles.spinner} role="presentation" />;
}
