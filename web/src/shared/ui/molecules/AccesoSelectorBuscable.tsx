import Select, { type StylesConfig } from 'react-select';
import { useTranslation } from 'react-i18next';
import { CampoFormulario } from './CampoFormulario';

export interface OpcionSelector {
  valor: string;
  etiqueta: string;
}

interface Props {
  etiqueta: string;
  opciones: readonly OpcionSelector[];
  /** El valor elegido; `''` = ninguno. */
  valor: string;
  onCambio: (valor: string) => void;
  placeholder?: string;
  ayuda?: string;
  error?: string;
  onBlur?: () => void;
  deshabilitado?: boolean;
  /** `false` en listas cortas (filtros, bancos): se elige sin escribir. Por defecto, con búsqueda. */
  conBusqueda?: boolean;
}

/**
 * Lista desplegable (react-select) con el aspecto de los campos del panel. Con búsqueda sirve para
 * listas largas, como las ciudades, donde escribir las primeras letras es más rápido que recorrerlas;
 * sin ella (`conBusqueda={false}`) reemplaza al `<select>` nativo en las listas cortas.
 * Todos los colores y medidas salen de los tokens (variables CSS), así que sigue el tema claro u oscuro.
 */
export function AccesoSelectorBuscable({
  etiqueta,
  opciones,
  valor,
  onCambio,
  placeholder,
  ayuda,
  error,
  onBlur,
  deshabilitado = false,
  conBusqueda = true,
}: Props) {
  const { t } = useTranslation('comun');
  const elegida = opciones.find((opcion) => opcion.valor === valor) ?? null;
  const estilos: StylesConfig<OpcionSelector, false> = {
    control: (base, estado) => ({
      ...base,
      minHeight: 'var(--altoControl)',
      background: deshabilitado ? 'var(--fondo)' : 'var(--superficie)',
      borderColor: error ? 'var(--peligro)' : estado.isFocused ? 'var(--primario)' : 'var(--borde)',
      borderWidth: estado.isFocused || error ? 2 : 1,
      borderRadius: 'var(--radio10)',
      boxShadow: 'none',
      ':hover': { borderColor: estado.isFocused ? 'var(--primario)' : 'var(--borde)' },
    }),
    valueContainer: (base) => ({ ...base, padding: '0 var(--esp16)' }),
    singleValue: (base) => ({ ...base, color: 'var(--texto)' }),
    input: (base) => ({ ...base, color: 'var(--texto)' }),
    placeholder: (base) => ({ ...base, color: 'var(--textoSecundario)' }),
    indicatorSeparator: () => ({ display: 'none' }),
    dropdownIndicator: (base) => ({ ...base, color: 'var(--textoSecundario)' }),
    menu: (base) => ({
      ...base,
      background: 'var(--superficie)',
      border: '1px solid var(--borde)',
      borderRadius: 'var(--radio10)',
      boxShadow: 'var(--elevacion2)',
      overflow: 'hidden',
      zIndex: 20,
    }),
    option: (base, estado) => ({
      ...base,
      minHeight: 'var(--altoControl)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 var(--esp16)',
      color: estado.isSelected ? 'var(--sobrePrimario)' : 'var(--texto)',
      background: estado.isSelected
        ? 'var(--primario)'
        : estado.isFocused
          ? 'var(--primarioSuave)'
          : 'transparent',
      cursor: 'pointer',
    }),
    noOptionsMessage: (base) => ({ ...base, color: 'var(--textoSecundario)' }),
  };
  return (
    <CampoFormulario etiqueta={etiqueta} ayuda={ayuda} error={error}>
      {(control) => (
        <Select<OpcionSelector>
          inputId={control.id}
          aria-describedby={control['aria-describedby']}
          aria-invalid={control['aria-invalid']}
          options={[...opciones]}
          value={elegida}
          onChange={(opcion) => {
            onCambio(opcion?.valor ?? '');
          }}
          onBlur={onBlur}
          isDisabled={deshabilitado}
          isClearable={false}
          isSearchable={conBusqueda}
          placeholder={placeholder ?? ''}
          getOptionValue={(opcion) => opcion.valor}
          getOptionLabel={(opcion) => opcion.etiqueta}
          noOptionsMessage={() => t('sinResultados')}
          styles={estilos}
        />
      )}
    </CampoFormulario>
  );
}
