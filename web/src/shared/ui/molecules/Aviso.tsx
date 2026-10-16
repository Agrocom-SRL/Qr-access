import type { ReactNode } from 'react';
import { Icono } from '../atoms/Icono';
import type { NombreIcono } from '../atoms/iconos';
import { cx } from '../../lib/cx';
import styles from './Aviso.module.css';

export type TonoAviso = 'informacion' | 'advertencia' | 'peligro' | 'exito';

const ICONO: Readonly<Record<TonoAviso, NombreIcono>> = {
  informacion: 'info',
  advertencia: 'warning',
  peligro: 'error',
  exito: 'info',
};

/** Aviso en línea con fondo `*Suave`, ícono y texto (nunca solo color). */
export function Aviso({
  tono,
  icono,
  children,
}: {
  tono: TonoAviso;
  /** Ícono propio; por defecto el del tono. */
  icono?: NombreIcono;
  children: ReactNode;
}) {
  return (
    <div className={cx(styles.aviso, styles[tono])} role={tono === 'peligro' ? 'alert' : 'note'}>
      <Icono nombre={icono ?? ICONO[tono]} tamano={20} />
      <div>{children}</div>
    </div>
  );
}
