import { cx } from '../../lib/cx';
import styles from './Avatar.module.css';

/** Iniciales de un nombre: primera letra de las dos primeras palabras. */
export function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((palabra) => palabra.charAt(0).toUpperCase())
    .join('');
}

export function Avatar({ nombre, grande = false }: { nombre: string; grande?: boolean }) {
  return (
    <span className={cx(styles.avatar, grande && styles.grande)} aria-hidden="true">
      {iniciales(nombre)}
    </span>
  );
}
