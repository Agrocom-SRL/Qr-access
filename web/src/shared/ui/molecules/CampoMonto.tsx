import type { InputHTMLAttributes, Ref } from 'react';
import { CampoFormulario } from './CampoFormulario';
import styles from './CampoMonto.module.css';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  etiqueta: string;
  /** Símbolo de la moneda ("Bs"), ya traducido. */
  moneda: string;
  ayuda?: string;
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

/** Monto con prefijo de moneda y cifras en mono (A07a). El formato lo decide quien lo usa. */
export function CampoMonto({ etiqueta, moneda, ayuda, error, ref, ...resto }: Props) {
  return (
    <CampoFormulario etiqueta={etiqueta} ayuda={ayuda} error={error}>
      {(control) => (
        <div className={styles.caja} data-invalido={error ? true : undefined}>
          <span className={styles.moneda}>{moneda}</span>
          <input ref={ref} className={styles.entrada} inputMode="numeric" {...control} {...resto} />
        </div>
      )}
    </CampoFormulario>
  );
}
