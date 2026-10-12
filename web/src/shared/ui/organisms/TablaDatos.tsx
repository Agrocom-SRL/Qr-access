import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { Skeleton } from '../atoms/Skeleton';
import styles from './TablaDatos.module.css';

export interface Columna<T> {
  id: string;
  encabezado: string;
  /** Contenido de la celda. Códigos, montos y fechas van con `TextoMono`. */
  celda: (fila: T) => ReactNode;
  /** Se oculta entre 768 y 1023 px (tablet). */
  secundaria?: boolean;
  alinear?: 'inicio' | 'fin';
}

interface Props<T> {
  columnas: readonly Columna<T>[];
  filas: readonly T[];
  claveDe: (fila: T) => string;
  /** Muestra filas esqueleto con la forma de las reales. */
  cargando?: boolean;
  /** Filas esqueleto a dibujar. */
  filasEsqueleto?: number;
  etiqueta: string;
  /** Paginador u otro pie dentro de la tarjeta. */
  pie?: ReactNode;
  /** Sin tarjeta propia (sombra y radio): va dentro de otra tarjeta. */
  incrustada?: boolean;
}

const ANCHOS = ['largo', 'medio', 'corto', 'completo'] as const;

/**
 * Tarjeta de radio 20 con encabezado `fondo` 12/600, filas de 56 mínimo y hover `fondo`.
 * Recibe `columnas` + `filas`, nunca el objeto crudo de la API (ISP).
 */
export function TablaDatos<T>({
  columnas,
  filas,
  claveDe,
  cargando = false,
  filasEsqueleto = 6,
  etiqueta,
  pie,
  incrustada = false,
}: Props<T>) {
  const clase = (c: Columna<T>) =>
    [c.secundaria ? styles.secundaria : '', c.alinear === 'fin' ? styles.fin : '']
      .filter(Boolean)
      .join(' ');
  return (
    <div className={cx(styles.tarjeta, incrustada && styles.incrustada)}>
      <table className={styles.tabla} aria-label={etiqueta} aria-busy={cargando || undefined}>
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c.id} scope="col" className={clase(c)}>
                {c.encabezado}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cargando
            ? Array.from({ length: filasEsqueleto }, (_, i) => (
                <tr key={i}>
                  {columnas.map((c, j) => (
                    <td key={c.id} className={clase(c)}>
                      <Skeleton ancho={ANCHOS[(i + j) % ANCHOS.length] ?? 'medio'} />
                    </td>
                  ))}
                </tr>
              ))
            : filas.map((fila) => (
                <tr key={claveDe(fila)} className={styles.fila}>
                  {columnas.map((c) => (
                    <td key={c.id} className={clase(c)}>
                      {c.celda(fila)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {pie}
    </div>
  );
}
