import { Aviso } from './Aviso';
import styles from './ExplicacionDePestana.module.css';

/**
 * Qué muestra una pestaña y cómo se lee: un título corto, lo que hay debajo y, aparte, cómo interpretar los
 * estados o filtros. Va justo debajo de las pestañas para que nadie tenga que adivinar qué significa cada una.
 */
export function ExplicacionDePestana({
  titulo,
  texto,
  lectura,
}: {
  titulo: string;
  texto: string;
  /** Cómo leer lo que se ve (estados, umbrales, filtros). */
  lectura?: string;
}) {
  return (
    <Aviso tono="informacion">
      <p className={styles.titulo}>{titulo}</p>
      <p className={styles.texto}>{texto}</p>
      {lectura === undefined ? null : <p className={styles.lectura}>{lectura}</p>}
    </Aviso>
  );
}
