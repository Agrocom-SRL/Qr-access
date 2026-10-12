import type { ReactNode } from 'react';
import { Icono } from '../atoms/Icono';
import type { NombreIcono } from '../atoms/iconos';
import { cx } from '../../lib/cx';
import styles from './TarjetaIndicador.module.css';

export type TonoIndicador = 'primario' | 'advertencia' | 'informacion' | 'peligro' | 'hero';

interface Props {
  etiqueta: string;
  /** Cifra en mono 32/600, ya formateada. */
  valor: string;
  detalle?: string;
  icono: NombreIcono;
  /** `hero` usa hero/sobreHero y el ícono sobre heroAcento. */
  tono?: TonoIndicador;
  /** Contenido extra bajo la cifra, p. ej. una `BarraUso`. */
  children?: ReactNode;
}

export function TarjetaIndicador({
  etiqueta,
  valor,
  detalle,
  icono,
  tono = 'primario',
  children,
}: Props) {
  return (
    <article className={cx(styles.tarjeta, tono === 'hero' && styles.hero)}>
      <div className={styles.cabecera}>
        <span className={styles.etiqueta}>{etiqueta}</span>
        <span className={cx(styles.icono, styles[tono])}>
          <Icono nombre={icono} />
        </span>
      </div>
      <p className={cx(styles.valor, tono === 'peligro' && styles.valorPeligro)}>{valor}</p>
      {children}
      {detalle ? <p className={styles.detalle}>{detalle}</p> : null}
    </article>
  );
}
