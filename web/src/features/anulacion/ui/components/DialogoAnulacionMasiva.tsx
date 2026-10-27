import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { AccesoCampoTexto } from '../../../../shared/ui/molecules/AccesoCampoTexto';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import { useAnularQrDeCuenta } from '../../application/useAnulacion';
import {
  MAX_MOTIVO_DE_ANULACION,
  confirmaCodigo,
  motivoDeAnulacion,
  puedeAnular,
} from '../../domain/anulacion';
import styles from './DialogoAnulacionMasiva.module.css';

interface Props {
  cuenta: { id: string; nombre: string; codigo: string };
  onCerrar: () => void;
}

/**
 * La confirmación de la anulación masiva: el resumen de lo que se anula, el motivo y el código de la cuenta.
 * Ni el motivo ni el código bastan solos: los dos tienen que estar bien para que el botón se habilite. Cancelar
 * cierra sin llamar a la API. Al anular, el diálogo muestra cuántos QR se anularon en vez de cerrarse.
 */
export function DialogoAnulacionMasiva({ cuenta, onCerrar }: Props) {
  const { t } = useTranslation(['anulacion', 'comun', 'errores']);
  const anular = useAnularQrDeCuenta(cuenta.id);
  const [motivo, setMotivo] = useState('');
  const [codigo, setCodigo] = useState('');
  const resultado = anular.data;
  const listo = puedeAnular(motivo, codigo, cuenta.codigo);

  const confirmar = () => {
    const motivoLimpio = motivoDeAnulacion(motivo);
    if (motivoLimpio === null || !confirmaCodigo(codigo, cuenta.codigo)) return;
    anular.mutate(motivoLimpio);
  };

  const acciones = resultado ? (
    <AccesoBoton variante="primario" onClick={onCerrar}>
      {t('comun:cerrar')}
    </AccesoBoton>
  ) : (
    <>
      <AccesoBoton variante="texto" onClick={onCerrar}>
        {t('comun:cancelar')}
      </AccesoBoton>
      <AccesoBoton
        variante="peligro"
        icono="block"
        cargando={anular.isPending}
        disabled={!listo}
        onClick={confirmar}
      >
        {anular.isPending ? t('anulacion:dialogo.anulando') : t('anulacion:dialogo.confirmar')}
      </AccesoBoton>
    </>
  );

  return (
    <Dialogo
      abierto
      icono="warning"
      titulo={t('anulacion:dialogo.titulo', { cuenta: cuenta.nombre })}
      onCerrar={onCerrar}
      acciones={acciones}
    >
      {resultado ? (
        <Aviso tono="exito">
          {resultado.qrAnulados === 0
            ? t('anulacion:resultado.ninguno')
            : t('anulacion:resultado.anulados', { count: resultado.qrAnulados })}
        </Aviso>
      ) : (
        <div className={styles.campos}>
          <p className={styles.resumen}>
            {t('anulacion:dialogo.resumen', { cuenta: cuenta.nombre, codigo: cuenta.codigo })}
          </p>
          <p className={styles.resumen}>
            <strong>{t('anulacion:dialogo.irreversible')}</strong>
          </p>
          <AccesoCampoTexto
            etiqueta={t('anulacion:dialogo.motivo')}
            ayuda={t('anulacion:dialogo.motivoAyuda')}
            value={motivo}
            maxLength={MAX_MOTIVO_DE_ANULACION}
            onChange={(evento) => {
              setMotivo(evento.target.value);
            }}
          />
          <AccesoCampoTexto
            etiqueta={t('anulacion:dialogo.codigo', { codigo: cuenta.codigo })}
            mono
            value={codigo}
            maxLength={3}
            autoComplete="off"
            autoCapitalize="characters"
            onChange={(evento) => {
              setCodigo(evento.target.value);
            }}
          />
        </div>
      )}
      {anular.isError ? (
        <Aviso tono="peligro">{traducirError(t, codigoDe(anular.error))}</Aviso>
      ) : null}
    </Dialogo>
  );
}
