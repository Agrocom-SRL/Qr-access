import { useTranslation } from 'react-i18next';
import { formatearNumero } from '../../../../l10n/formatos';
import { detalleDeSenal, type TipoDeSenal } from '../../domain/senal';

/**
 * El detalle de una señal en texto. `descripcion` llega como código (`aperturas=13;umbral=12`): acá
 * se traduce a una frase con sus números; nunca se muestra el código crudo.
 */
export function DescripcionDeSenal({
  tipo,
  descripcion,
}: {
  tipo: TipoDeSenal;
  descripcion: string | null;
}) {
  const { t, i18n } = useTranslation('senales');
  const detalle = detalleDeSenal(tipo, descripcion);
  if (detalle === null) return <span>{t('lista.descripcion.sinDetalle')}</span>;
  const valores = Object.fromEntries(
    Object.entries(detalle.valores).map(([clave, valor]) => [
      clave,
      formatearNumero(valor, i18n.language),
    ]),
  );
  return <span>{t(`lista.descripcion.${detalle.clave}`, valores)}</span>;
}
