import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BotonIcono } from '../atoms/BotonIcono';
import { Icono } from '../atoms/Icono';
import type { NombreIcono } from '../atoms/iconos';
import { cx } from '../../lib/cx';
import styles from './Dialogo.module.css';

interface Props {
  abierto: boolean;
  titulo: string;
  onCerrar: () => void;
  /** 480 (confirmaciones), 640 (formularios) u 880 (formularios con muchos campos). */
  ancho?: 'angosto' | 'ancho' | 'amplio';
  children: ReactNode;
  /** Acciones a la derecha: texto + primario. */
  acciones?: ReactNode;
  /** Ícono en caja `primarioSuave` sobre el título (A07b); sin él no hay caja ni botón de cierre propio. */
  icono?: NombreIcono;
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
  icono,
}: Props) {
  const { t } = useTranslation('comun');
  const ref = useRef<HTMLDialogElement>(null);
  // Un id fijo rompe los diálogos anidados (una confirmación sobre una ficha): dos títulos con el mismo id.
  const idTitulo = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) {
      // jsdom no implementa showModal; en navegadores siempre existe.
      if (typeof dialogo.showModal === 'function') dialogo.showModal();
      else dialogo.setAttribute('open', '');
    }
    if (!abierto && dialogo.open) {
      if (typeof dialogo.close === 'function') dialogo.close();
      else dialogo.removeAttribute('open');
    }
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      className={cx(styles.dialogo, styles[ancho])}
      aria-labelledby={idTitulo}
      onClose={onCerrar}
      onCancel={(e) => {
        e.preventDefault();
        onCerrar();
      }}
    >
      {icono ? (
        <span className={styles.icono}>
          <Icono nombre={icono} />
        </span>
      ) : null}
      <div className={styles.cabecera}>
        <h2 id={idTitulo} className={styles.titulo}>
          {titulo}
        </h2>
        {icono ? null : <BotonIcono icono="close" etiqueta={t('cerrar')} onClick={onCerrar} />}
      </div>
      <div className={styles.cuerpo}>{children}</div>
      {acciones ? <div className={styles.acciones}>{acciones}</div> : null}
    </dialog>
  );
}
