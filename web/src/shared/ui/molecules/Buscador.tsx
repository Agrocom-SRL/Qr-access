import type { InputHTMLAttributes } from 'react';
import { Icono } from '../atoms/Icono';
import styles from './Buscador.module.css';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Etiqueta accesible: el buscador no tiene etiqueta visible. */
  etiqueta: string;
}

/** Campo de búsqueda de radio completo con lupa. */
export function Buscador({ etiqueta, className, ...resto }: Props) {
  return (
    <label className={[styles.buscador, className].filter(Boolean).join(' ')}>
      <Icono nombre="search" />
      <input type="search" className={styles.entrada} aria-label={etiqueta} {...resto} />
    </label>
  );
}
