import type { InputHTMLAttributes } from 'react';
import styles from './AccesoInterruptor.module.css';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  etiqueta: string;
}

/** Interruptor accesible (checkbox con rol `switch`) de 44 px de alto táctil. */
export function AccesoInterruptor({ etiqueta, ...resto }: Props) {
  return (
    <label className={styles.contenedor}>
      <input type="checkbox" role="switch" className={styles.entrada} {...resto} />
      <span className={styles.pista} aria-hidden="true" />
      {etiqueta}
    </label>
  );
}
