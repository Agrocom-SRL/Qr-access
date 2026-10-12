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

export function Avatar({ nombre }: { nombre: string }) {
  return (
    <span className={styles.avatar} aria-hidden="true">
      {iniciales(nombre)}
    </span>
  );
}
