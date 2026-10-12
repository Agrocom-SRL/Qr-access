import type { ReactNode } from 'react';
import { Icono } from './Icono';
import type { NombreIcono } from './iconos';
import { cx } from '../../lib/cx';
import styles from './AccesoBadge.module.css';

export type TonoBadge = 'primario' | 'advertencia' | 'peligro' | 'informacion' | 'neutro';

interface Props {
  tono: TonoBadge;
  icono?: NombreIcono;
  children: ReactNode;
}

/** Etiqueta de estado de 24 de alto. Siempre lleva texto: nunca comunica solo con color. */
export function AccesoBadge({ tono, icono, children }: Props) {
  return (
    <span className={cx(styles.badge, styles[tono])}>
      {icono ? <Icono nombre={icono} tamano={16} /> : null}
      {children}
    </span>
  );
}
