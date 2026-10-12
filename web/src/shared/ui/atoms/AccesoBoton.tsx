import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icono } from './Icono';
import type { NombreIcono } from './iconos';
import { Spinner } from './Spinner';
import styles from './AccesoBoton.module.css';

export type VarianteBoton = 'primario' | 'tonal' | 'texto' | 'peligro';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variante?: VarianteBoton;
  /** Ícono a la izquierda de la etiqueta. */
  icono?: NombreIcono;
  /** Muestra el spinner; la etiqueta ya debe venir en gerundio ("Ingresando"). */
  cargando?: boolean;
  /** El botón ocupa todo el ancho de su contenedor. */
  bloque?: boolean;
  children: ReactNode;
}

/** Botón del sistema de diseño (README del handoff): alto 48, radio completo, texto 16/600. */
export function AccesoBoton({
  variante = 'primario',
  icono,
  cargando = false,
  bloque = false,
  className,
  disabled,
  type = 'button',
  children,
  ...resto
}: Props) {
  const clases = [styles.boton, styles[variante], bloque ? styles.bloque : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type={type}
      className={clases}
      disabled={disabled === true || cargando}
      aria-busy={cargando || undefined}
      {...resto}
    >
      {cargando ? <Spinner /> : icono ? <Icono nombre={icono} tamano={20} /> : null}
      {children}
    </button>
  );
}
