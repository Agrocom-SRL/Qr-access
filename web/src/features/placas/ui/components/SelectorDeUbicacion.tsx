import { useTranslation } from 'react-i18next';
import { FiltroSegmentado } from '../../../../shared/ui/molecules/FiltroSegmentado';
import { UBICACIONES_DEL_LECTOR, type UbicacionDelLector } from '../../domain/placa';

interface Props {
  valor: UbicacionDelLector;
  onCambio: (valor: UbicacionDelLector) => void;
}

/**
 * Dónde está el lector de la placa que se vincula (ADR 0035): una puerta lleva una placa o dos, la del lector de
 * afuera y la del de adentro, que accionan la misma cerradura. Con una sola, «Una sola placa».
 */
export function SelectorDeUbicacion({ valor, onCambio }: Props) {
  const { t } = useTranslation('placas');
  return (
    <div>
      <FiltroSegmentado
        etiqueta={t('ubicacionLector')}
        valor={valor}
        onCambio={onCambio}
        opciones={UBICACIONES_DEL_LECTOR.map((ubicacion) => ({
          valor: ubicacion,
          etiqueta: t(`ubicacion.${ubicacion}`),
        }))}
      />
      <p>{t('ubicacionAyuda')}</p>
    </div>
  );
}
