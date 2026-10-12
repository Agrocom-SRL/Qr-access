import { useId, type ReactNode } from 'react';
import { Icono } from '../atoms/Icono';
import styles from './CampoFormulario.module.css';

export interface PropsControl {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
}

interface Props {
  etiqueta: string;
  ayuda?: string;
  /** Mensaje de error ya traducido; si existe, manda sobre la ayuda. */
  error?: string;
  /** Marca el control en rojo sin mensaje propio (el mensaje sale en otro campo). */
  invalido?: boolean;
  children: (control: PropsControl) => ReactNode;
}

/**
 * Etiqueta arriba (14/500, gap 8), control, y ayuda (12) o error (14/500 con ícono) abajo.
 * Conecta etiqueta y mensajes con el control por `id` y `aria-describedby`.
 */
export function CampoFormulario({ etiqueta, ayuda, error, invalido = false, children }: Props) {
  const id = useId();
  const idMensaje = `${id}-mensaje`;
  const hayMensaje = Boolean(error ?? ayuda);
  return (
    <div className={styles.campo}>
      <label htmlFor={id} className={styles.etiqueta}>
        {etiqueta}
      </label>
      {children({
        id,
        'aria-describedby': hayMensaje ? idMensaje : undefined,
        'aria-invalid': error || invalido ? true : undefined,
      })}
      {error ? (
        <p id={idMensaje} className={styles.error} role="alert">
          <Icono nombre="error" tamano={16} />
          {error}
        </p>
      ) : ayuda ? (
        <p id={idMensaje} className={styles.ayuda}>
          {ayuda}
        </p>
      ) : null}
    </div>
  );
}
