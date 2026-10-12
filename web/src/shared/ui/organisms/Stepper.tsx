import { Icono } from '../atoms/Icono';
import { cx } from '../../lib/cx';
import styles from './Stepper.module.css';

export interface PasoDelStepper {
  id: string;
  etiqueta: string;
}

interface Props {
  pasos: readonly PasoDelStepper[];
  /** Índice del paso actual. */
  actual: number;
  etiqueta: string;
}

/**
 * Pasos numerados: círculos de 32 con borde 2. El activo y los completados van en primario; el
 * completado lleva `check` y la línea que lo sigue también se pinta (300 ms, README "Stepper").
 */
export function Stepper({ pasos, actual, etiqueta }: Props) {
  return (
    <ol className={styles.lista} aria-label={etiqueta}>
      {pasos.map((paso, i) => {
        const completado = i < actual;
        const activo = i === actual;
        return (
          <li
            key={paso.id}
            className={cx(styles.paso, completado && styles.completo, activo && styles.activo)}
            aria-current={activo ? 'step' : undefined}
          >
            <span className={styles.circulo}>
              {completado ? <Icono nombre="check" tamano={18} /> : i + 1}
            </span>
            <span className={styles.etiqueta}>{paso.etiqueta}</span>
            {i < pasos.length - 1 ? <span className={styles.linea} aria-hidden="true" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
