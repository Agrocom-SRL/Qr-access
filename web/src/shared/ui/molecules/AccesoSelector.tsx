import type { Ref, SelectHTMLAttributes } from 'react';
import { CampoFormulario } from './CampoFormulario';
import estilos from './controles.module.css';

export interface OpcionSelector {
  valor: string;
  etiqueta: string;
}

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'children'> {
  etiqueta: string;
  opciones: readonly OpcionSelector[];
  ayuda?: string;
  error?: string;
  ref?: Ref<HTMLSelectElement>;
}

/** Selector nativo con el aspecto de los campos de texto (teclado y lectores sin trabajo extra). */
export function AccesoSelector({
  etiqueta,
  opciones,
  ayuda,
  error,
  className,
  ref,
  ...resto
}: Props) {
  return (
    <CampoFormulario etiqueta={etiqueta} ayuda={ayuda} error={error}>
      {(control) => (
        <select
          ref={ref}
          className={[estilos.control, className].filter(Boolean).join(' ')}
          {...control}
          {...resto}
        >
          {opciones.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </option>
          ))}
        </select>
      )}
    </CampoFormulario>
  );
}
