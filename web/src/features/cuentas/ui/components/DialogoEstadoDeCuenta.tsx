import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { AccesoCampoTexto } from '../../../../shared/ui/molecules/AccesoCampoTexto';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import { useCambiarEstadoDeCuenta } from '../../application/useCuentas';
import styles from './DialogoEditarCuenta.module.css';

/** Lo mismo que acepta la API en `estado_motivo` (VARCHAR(200)). */
const MAXIMO_DEL_MOTIVO = 200;

interface Props {
  /** Qué se hace; `null` mantiene el diálogo cerrado. */
  accion: 'restringir' | 'suspender' | null;
  onCerrar: () => void;
  cuenta: { id: string; nombre: string };
}

/**
 * Restringe o suspende la cuenta (ADR 0033 §1). El motivo es obligatorio y queda en la bitácora; el
 * diálogo dice qué pasa con los QR y las sesiones antes de confirmar, porque suspender las corta.
 */
export function DialogoEstadoDeCuenta({ accion, onCerrar, cuenta }: Props) {
  const { t } = useTranslation(['detalle', 'comun']);
  const cambiar = useCambiarEstadoDeCuenta(cuenta.id);
  const [motivo, setMotivo] = useState('');
  const cerrar = () => {
    setMotivo('');
    cambiar.reset();
    onCerrar();
  };
  if (accion === null)
    return (
      <Dialogo abierto={false} titulo="" onCerrar={cerrar}>
        {null}
      </Dialogo>
    );
  const valido = motivo.trim() !== '';
  return (
    <Dialogo
      abierto
      icono={accion === 'suspender' ? 'block' : 'lock'}
      titulo={t(`detalle:estado.${accion}.titulo`, { cuenta: cuenta.nombre })}
      onCerrar={cerrar}
      ancho="ancho"
      acciones={
        <>
          <AccesoBoton variante="texto" onClick={cerrar}>
            {t('comun:cancelar')}
          </AccesoBoton>
          <AccesoBoton
            variante={accion === 'suspender' ? 'peligro' : 'advertencia'}
            cargando={cambiar.isPending}
            disabled={!valido}
            onClick={() => {
              cambiar.mutate({ accion, motivo: motivo.trim() }, { onSuccess: cerrar });
            }}
          >
            {t(`detalle:estado.${accion}.confirmar`)}
          </AccesoBoton>
        </>
      }
    >
      <div className={styles.campos}>
        <p>{t(`detalle:estado.${accion}.texto`)}</p>
        <AccesoCampoTexto
          etiqueta={t('detalle:estado.motivo')}
          ayuda={t('detalle:estado.motivoAyuda')}
          maxLength={MAXIMO_DEL_MOTIVO}
          value={motivo}
          autoComplete="off"
          onChange={(e) => {
            setMotivo(e.target.value);
          }}
        />
        {cambiar.isError ? (
          <Aviso tono="peligro">{traducirError(t, codigoDe(cambiar.error))}</Aviso>
        ) : null}
      </div>
    </Dialogo>
  );
}
