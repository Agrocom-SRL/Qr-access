import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { AccesoInterruptor } from '../../../../shared/ui/atoms/AccesoInterruptor';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { FiltroSegmentado } from '../../../../shared/ui/molecules/FiltroSegmentado';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import { useConfigurarSensorDePlaca } from '../../application/usePlacas';
import type { NivelAbierto, Placa } from '../../domain/placa';

interface Props {
  placa: Placa;
  onCerrar: () => void;
}

/**
 * Habilita el sensor de la puerta de una placa vinculada y fija su nivel con la puerta abierta.
 * La polaridad no se puede saber desde el panel: se confirma en campo (ADR 0031 §18), por eso el
 * aviso va en el mismo diálogo.
 */
export function DialogoSensorDePuerta({ placa, onCerrar }: Props) {
  const { t } = useTranslation(['placas', 'comun']);
  const configurar = useConfigurarSensorDePlaca();
  const [instalado, setInstalado] = useState(placa.sensorConfigurado?.instalado ?? false);
  const [nivel, setNivel] = useState<NivelAbierto>(placa.sensorConfigurado?.nivelAbierto ?? 'alto');

  const enviar = () => {
    configurar.mutate(
      { placaId: placa.id, sensor: { instalado, nivelAbierto: nivel } },
      {
        onSuccess: () => {
          onCerrar();
        },
      },
    );
  };

  return (
    <Dialogo
      abierto
      titulo={t('placas:sensorTitulo')}
      onCerrar={onCerrar}
      ancho="angosto"
      acciones={
        <>
          <AccesoBoton variante="texto" onClick={onCerrar}>
            {t('comun:cancelar')}
          </AccesoBoton>
          <AccesoBoton
            cargando={configurar.isPending}
            disabled={configurar.isPending}
            onClick={enviar}
          >
            {configurar.isPending ? t('placas:sensorGuardando') : t('placas:sensorGuardar')}
          </AccesoBoton>
        </>
      }
    >
      <p>{t('placas:sensorTexto')}</p>
      <AccesoInterruptor
        etiqueta={t('placas:sensorInstalado')}
        checked={instalado}
        onChange={(evento) => {
          setInstalado(evento.target.checked);
        }}
      />
      <FiltroSegmentado<NivelAbierto>
        etiqueta={t('placas:sensorNivel')}
        valor={nivel}
        onCambio={setNivel}
        opciones={[
          { valor: 'alto', etiqueta: t('placas:sensorAlto') },
          { valor: 'bajo', etiqueta: t('placas:sensorBajo') },
        ]}
      />
      <Aviso tono="informacion">{t('placas:sensorPolaridad')}</Aviso>
      {configurar.isError ? (
        <Aviso tono="peligro">{traducirError(t, codigoDe(configurar.error))}</Aviso>
      ) : null}
    </Dialogo>
  );
}
