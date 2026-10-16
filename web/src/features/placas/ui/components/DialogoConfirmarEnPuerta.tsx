import { useTranslation } from 'react-i18next';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import { minutosRestantes } from '../../domain/placa';

interface Props {
  mac: string;
  esperaHasta: Date;
  onCerrar: () => void;
}

/**
 * Segundo paso de la vinculación (ADR 0026): el vínculo ya se pidió y solo falta que alguien
 * mantenga pulsado el botón de la placa en la puerta; eso es la prueba de presencia física.
 */
export function DialogoConfirmarEnPuerta({ mac, esperaHasta, onCerrar }: Props) {
  const { t } = useTranslation('placas');
  return (
    <Dialogo
      abierto
      titulo={t('confirmarTitulo')}
      onCerrar={onCerrar}
      ancho="angosto"
      acciones={<AccesoBoton onClick={onCerrar}>{t('listo')}</AccesoBoton>}
    >
      <p>{t('confirmarTexto', { mac })}</p>
      <ol>
        <li>{t('confirmarPaso1')}</li>
        <li>{t('confirmarPaso2')}</li>
        <li>{t('confirmarPaso3')}</li>
      </ol>
      <Aviso tono="informacion">
        {t('confirmarVentana', { count: minutosRestantes(esperaHasta, new Date()) })}
      </Aviso>
    </Dialogo>
  );
}
