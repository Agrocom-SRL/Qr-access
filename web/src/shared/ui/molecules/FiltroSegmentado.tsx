import { TextoMono } from '../atoms/TextoMono';
import { cx } from '../../lib/cx';
import styles from './FiltroSegmentado.module.css';

export interface OpcionFiltro<V extends string> {
  valor: V;
  etiqueta: string;
  /** Conteo en mono 12; se omite si no corresponde. */
  conteo?: number;
}

interface Props<V extends string> {
  opciones: readonly OpcionFiltro<V>[];
  valor: V;
  onCambio: (valor: V) => void;
  etiqueta: string;
}

/** Filtro segmentado: contenedor de radio completo; la opción activa va en primario. */
export function FiltroSegmentado<V extends string>({
  opciones,
  valor,
  onCambio,
  etiqueta,
}: Props<V>) {
  return (
    <div className={styles.contenedor} role="group" aria-label={etiqueta}>
      {opciones.map((opcion) => (
        <button
          key={opcion.valor}
          type="button"
          className={cx(styles.opcion, opcion.valor === valor && styles.activa)}
          aria-pressed={opcion.valor === valor}
          onClick={() => {
            onCambio(opcion.valor);
          }}
        >
          {opcion.etiqueta}
          {opcion.conteo === undefined ? null : (
            <span className={styles.conteo}>
              <TextoMono>{opcion.conteo}</TextoMono>
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
