import type { KeyboardEvent } from 'react';
import { cx } from '../../lib/cx';
import styles from './Pestanas.module.css';

export interface Pestana<V extends string> {
  id: V;
  etiqueta: string;
}

interface Props<V extends string> {
  pestanas: readonly Pestana<V>[];
  activa: V;
  onCambio: (id: V) => void;
  etiqueta: string;
}

/** Pestañas con flechas del teclado; el cambio es de 200 ms (README, "Movimiento"). */
export function Pestanas<V extends string>({ pestanas, activa, onCambio, etiqueta }: Props<V>) {
  const alTeclear = (e: KeyboardEvent<HTMLButtonElement>, indice: number) => {
    const paso = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (paso === 0) return;
    const destino = pestanas[(indice + paso + pestanas.length) % pestanas.length];
    if (destino) onCambio(destino.id);
  };
  return (
    <div role="tablist" aria-label={etiqueta} className={styles.lista}>
      {pestanas.map((pestana, i) => (
        <button
          key={pestana.id}
          type="button"
          role="tab"
          aria-selected={pestana.id === activa}
          tabIndex={pestana.id === activa ? 0 : -1}
          className={cx(styles.pestana, pestana.id === activa && styles.activa)}
          onClick={() => {
            onCambio(pestana.id);
          }}
          onKeyDown={(e) => {
            alTeclear(e, i);
          }}
        >
          {pestana.etiqueta}
        </button>
      ))}
    </div>
  );
}
