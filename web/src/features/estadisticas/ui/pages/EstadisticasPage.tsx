import { useTranslation } from 'react-i18next';
import { EncabezadoPagina } from '../../../../shared/ui/molecules/EncabezadoPagina';
import { GraficasDelResumen } from '../GraficasDelResumen';
import { UsoPorPlan } from '../UsoPorPlan';
import styles from './EstadisticasPage.module.css';

/** Las estadísticas de la plataforma: cobros, accesos, altas, cuentas por estado y el uso de cada plan. */
export function EstadisticasPage() {
  const { t } = useTranslation('estadisticas');
  return (
    <>
      <EncabezadoPagina titulo={t('titulo')} subtitulo={t('subtitulo')} />
      <div className={styles.contenido}>
        <GraficasDelResumen />
        <UsoPorPlan />
      </div>
    </>
  );
}
