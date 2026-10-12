import type { ButtonHTMLAttributes } from 'react';
import styles from './AccesoBoton.module.css';

type Variante = 'primario' | 'secundario' | 'texto' | 'peligro';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
}

/** Botón del sistema de diseño: alto mínimo 44 px y colores solo por tokens. */
export function AccesoBoton({ variante = 'primario', className, ...resto }: Props) {
  const clases = [styles.boton, styles[variante], className].filter(Boolean).join(' ');
  return <button type="button" className={clases} {...resto} />;
}
