import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { RUTAS } from '../../lib/rutas';
import { BotonVolver } from './BotonVolver';
import styles from './EncabezadoPagina.module.css';

interface Props {
  titulo: string;
  subtitulo?: string;
  /** Acción primaria, a la derecha. */
  accion?: ReactNode;
}

/**
 * Título 32/600, subtítulo 16 en texto secundario y la acción primaria a la derecha. Fuera del
 * resumen lleva el botón de volver a la página anterior.
 */
export function EncabezadoPagina({ titulo, subtitulo, accion }: Props) {
  const { pathname } = useLocation();
  return (
    <header className={styles.encabezado}>
      <div>
        {pathname === RUTAS.resumen ? null : (
          <div className={styles.volver}>
            <BotonVolver alternativa={RUTAS.resumen} />
          </div>
        )}
        <h1 className={styles.titulo}>{titulo}</h1>
        {subtitulo ? <p className={styles.subtitulo}>{subtitulo}</p> : null}
      </div>
      {accion}
    </header>
  );
}
