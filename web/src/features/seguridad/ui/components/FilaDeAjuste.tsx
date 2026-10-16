import type { ReactNode } from 'react';
import { Icono } from '../../../../shared/ui/atoms/Icono';
import styles from './FilaDeAjuste.module.css';

interface Props {
  etiqueta: string;
  /** Lo que vale hoy el ajuste (a la derecha, en texto secundario). */
  valor?: ReactNode;
  /** Sin `onAbrir` la fila es solo informativa (usuario, último ingreso). */
  onAbrir?: () => void;
}

/** Una fila de ajustes como en el móvil: etiqueta, valor actual y flecha; al tocarla abre su modal. */
export function FilaDeAjuste({ etiqueta, valor, onAbrir }: Props) {
  const contenido = (
    <>
      <span className={styles.etiqueta}>{etiqueta}</span>
      <span className={styles.valor}>{valor}</span>
      {onAbrir ? <Icono nombre="chevron_right" /> : null}
    </>
  );
  return onAbrir ? (
    <button type="button" className={styles.fila} onClick={onAbrir}>
      {contenido}
    </button>
  ) : (
    <div className={styles.fila}>{contenido}</div>
  );
}
