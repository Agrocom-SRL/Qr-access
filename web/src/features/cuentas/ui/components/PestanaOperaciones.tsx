import { PanelAnulacionMasiva } from '../../../anulacion';
import { PanelExportacion } from '../../../exportacion';
import styles from './PestanaOperaciones.module.css';

interface Props {
  cuenta: { id: string; nombre: string; codigo: string };
}

/**
 * La pestaña "QR y datos" de la ficha: anular en bloque los QR de la cuenta y exportar sus datos. Cada sección
 * se oculta sola si el rol no tiene su permiso; la API lo vuelve a exigir.
 */
export function PestanaOperaciones({ cuenta }: Props) {
  return (
    <div className={styles.contenido}>
      <PanelAnulacionMasiva cuenta={cuenta} />
      <PanelExportacion cuenta={cuenta} />
    </div>
  );
}
