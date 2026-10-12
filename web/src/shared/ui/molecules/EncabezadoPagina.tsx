import type { ReactNode } from 'react';
import styles from './EncabezadoPagina.module.css';

interface Props {
  titulo: string;
  subtitulo?: string;
  /** Acción primaria, a la derecha. */
  accion?: ReactNode;
}

/** Título 32/600, subtítulo 16 en texto secundario y la acción primaria a la derecha. */
export function EncabezadoPagina({ titulo, subtitulo, accion }: Props) {
  return (
    <header className={styles.encabezado}>
      <div>
        <h1 className={styles.titulo}>{titulo}</h1>
        {subtitulo ? <p className={styles.subtitulo}>{subtitulo}</p> : null}
      </div>
      {accion}
    </header>
  );
}
