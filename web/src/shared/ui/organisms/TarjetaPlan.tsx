import type { ReactNode } from 'react';
import { Icono } from '../atoms/Icono';
import { cx } from '../../lib/cx';
import styles from './TarjetaPlan.module.css';

interface Props {
  /** Nombre del plan, sobre el cupo. */
  nombre: string;
  /** "Hasta" */
  etiquetaCupo: string;
  /** "100 usuarios" */
  cupo: string;
  /** Contenido principal (precio editable, precio fijo…). */
  children: ReactNode;
  /** Pie dentro de la tarjeta (cuentas y uso, ventajas…). */
  pie?: ReactNode;
  /** Esquina superior derecha; por defecto, el ícono de usuarios. */
  esquina?: ReactNode;
  seleccionada?: boolean;
}

/** Tarjeta de un plan: cupo grande, ícono, cuerpo y pie. La reusan Planes (A09) y "Elige el plan" (A04b). */
export function TarjetaPlan({
  nombre,
  etiquetaCupo,
  cupo,
  children,
  pie,
  esquina,
  seleccionada = false,
}: Props) {
  return (
    <article className={cx(styles.tarjeta, seleccionada && styles.seleccionada)}>
      <div className={styles.cabecera}>
        <div>
          <p className={styles.nombre}>{nombre}</p>
          <p className={styles.hasta}>{etiquetaCupo}</p>
          <h2 className={styles.cupo}>{cupo}</h2>
        </div>
        {esquina ?? (
          <span className={styles.icono}>
            <Icono nombre="group" />
          </span>
        )}
      </div>
      <div className={styles.cuerpo}>{children}</div>
      {pie ? <div className={styles.pie}>{pie}</div> : null}
    </article>
  );
}
