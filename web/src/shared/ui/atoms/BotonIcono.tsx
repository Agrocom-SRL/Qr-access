import type { ButtonHTMLAttributes } from 'react';
import { Icono } from './Icono';
import type { NombreIcono } from './iconos';
import styles from './BotonIcono.module.css';

/** Color fijo por acción (theme.ts › colorAccion): ver, editar y eliminar o suspender. */
export type AccionBotonIcono = 'ver' | 'editar' | 'eliminar' | 'neutro';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icono: NombreIcono;
  /** Etiqueta accesible y tooltip: el botón no tiene texto visible. */
  etiqueta: string;
  accion?: AccionBotonIcono;
}

/** Botón de ícono de 44×44, radio completo; en hover pinta el fondo `*Suave` de su acción. */
export function BotonIcono({
  icono,
  etiqueta,
  accion = 'neutro',
  className,
  type = 'button',
  ...resto
}: Props) {
  return (
    <button
      type={type}
      className={[styles.boton, styles[accion], className].filter(Boolean).join(' ')}
      aria-label={etiqueta}
      title={etiqueta}
      {...resto}
    >
      <Icono nombre={icono} />
    </button>
  );
}
