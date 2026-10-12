import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BotonIcono } from '../atoms/BotonIcono';
import { cx } from '../../lib/cx';
import styles from './Dialogo.module.css';

interface Props {
  abierto: boolean;
  titulo: string;
  onCerrar: () => void;
  /** 480 (confirmaciones) o 640 (formularios). */
  ancho?: 'angosto' | 'ancho';
  children: ReactNode;
  /** Acciones a la derecha: texto + primario. */
  acciones?: ReactNode;
}

/**
 * Diálogo modal sobre `<dialog>` nativo: atrapa el foco, cierra con Esc y devuelve el foco al
 * disparador. Scrim, radio 20, padding 32 y elevacion3.
 */
export function Dialogo({
  abierto,
  titulo,
  onCerrar,
  ancho = 'angosto',
  children,
  acciones,
}: Props) {
  const { t } = useTranslation('comun');
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) {
      // jsdom no implementa showModal; en navegadores siempre existe.
      if (typeof dialogo.showModal === 'function') dialogo.showModal();
      else dialogo.setAttribute('open', '');
    }
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      className={cx(styles.dialogo, styles[ancho])}
      aria-labelledby="titulo-dialogo"
      onClose={onCerrar}
      onCancel={(e) => {
        e.preventDefault();
        onCerrar();
      }}
    >
      <div className={styles.cabecera}>
        <h2 id="titulo-dialogo" className={styles.titulo}>
          {titulo}
        </h2>
        <BotonIcono icono="close" etiqueta={t('cerrar')} onClick={onCerrar} />
      </div>
      <div className={styles.cuerpo}>{children}</div>
      {acciones ? <div className={styles.acciones}>{acciones}</div> : null}
    </dialog>
  );
}
