import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { tienePermiso, useSesion } from '../../../seguridad';
import { PERMISO_ANULAR_QR_DE_CUENTA } from '../../domain/anulacion';
import { DialogoAnulacionMasiva } from './DialogoAnulacionMasiva';
import styles from './PanelAnulacionMasiva.module.css';

interface Props {
  cuenta: { id: string; nombre: string; codigo: string };
}

/**
 * La acción de anular todos los QR de la cuenta (ADR 0033 §3). Sin el permiso no se muestra nada; la API
 * igual lo exige (403). La acción abre la confirmación: nunca anula desde el botón de la sección.
 */
export function PanelAnulacionMasiva({ cuenta }: Props) {
  const { t } = useTranslation('anulacion');
  const { sesion } = useSesion();
  const [abierto, setAbierto] = useState(false);
  if (!tienePermiso(sesion?.permisos ?? [], PERMISO_ANULAR_QR_DE_CUENTA)) return null;
  return (
    <section className={styles.seccion} aria-labelledby="anulacion-titulo">
      <h2 id="anulacion-titulo" className={styles.titulo}>
        {t('titulo')}
      </h2>
      <p className={styles.texto}>{t('explicacion')}</p>
      <div>
        <AccesoBoton
          variante="peligro"
          icono="block"
          onClick={() => {
            setAbierto(true);
          }}
        >
          {t('boton')}
        </AccesoBoton>
      </div>
      {abierto ? (
        <DialogoAnulacionMasiva
          cuenta={cuenta}
          onCerrar={() => {
            setAbierto(false);
          }}
        />
      ) : null}
    </section>
  );
}
