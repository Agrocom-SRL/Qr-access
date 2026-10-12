import { useTranslation } from 'react-i18next';
import { traducirError } from '../../../l10n/traducirError';
import { AccesoBoton } from '../atoms/AccesoBoton';
import { EstadoVacio } from './EstadoVacio';

interface Props {
  titulo: string;
  /** `code` de la API; se traduce y se muestra en mono debajo. */
  code?: string;
  onReintentar: () => void;
}

/** Error de carga: texto traducido por código, el código en mono y "Reintentar" tonal (PE3). */
export function EstadoError({ titulo, code, onReintentar }: Props) {
  const { t } = useTranslation('comun');
  return (
    <EstadoVacio
      ilustracion="error"
      titulo={titulo}
      texto={traducirError(t, code)}
      codigo={code ? t('codigo', { codigo: code }) : undefined}
      accion={
        <AccesoBoton variante="tonal" icono="refresh" onClick={onReintentar}>
          {t('reintentar')}
        </AccesoBoton>
      }
    />
  );
}
