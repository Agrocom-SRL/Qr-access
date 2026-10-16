import type { InputHTMLAttributes, Ref } from 'react';
import { CampoFormulario } from './CampoFormulario';
import estilos from './controles.module.css';

export interface PropsCampoTexto extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  etiqueta: string;
  ayuda?: string;
  error?: string;
  invalido?: boolean;
  /** Muestra el valor en IBM Plex Mono (códigos, NIT, montos). */
  mono?: boolean;
  ref?: Ref<HTMLInputElement>;
}

/** Campo de texto: alto 48, radio 10; foco y error en borde de 2 px. */
export function AccesoCampoTexto({
  etiqueta,
  ayuda,
  error,
  invalido,
  mono = false,
  className,
  ref,
  ...resto
}: PropsCampoTexto) {
  return (
    <CampoFormulario etiqueta={etiqueta} ayuda={ayuda} error={error} invalido={invalido}>
      {(control) => (
        <input
          ref={ref}
          className={[estilos.control, mono ? estilos.mono : '', className]
            .filter(Boolean)
            .join(' ')}
          {...control}
          {...resto}
        />
      )}
    </CampoFormulario>
  );
}
