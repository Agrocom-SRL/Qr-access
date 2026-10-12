import { useTranslation } from 'react-i18next';
import { codigoDe } from '../../../shared/api/errorApi';
import { Skeleton } from '../../../shared/ui/atoms/Skeleton';
import { EstadoError } from '../../../shared/ui/organisms/EstadoError';
import { useEstadisticas } from '../application/useEstadisticas';
import { AccesosPorDia } from './AccesosPorDia';
import { AltasPorMes } from './AltasPorMes';
import { CobradoPorMes } from './CobradoPorMes';
import { CuentasPorEstado } from './CuentasPorEstado';
import { CuentasPorPlan } from './CuentasPorPlan';
import styles from './GraficasDelResumen.module.css';

/** Las cinco gráficas del Resumen (A02): cobros, accesos, altas y cómo se reparten las cuentas. */
export function GraficasDelResumen() {
  const { t } = useTranslation('estadisticas');
  const consulta = useEstadisticas();
  if (consulta.isError) {
    return (
      <EstadoError
        titulo={t('errorCarga')}
        code={codigoDe(consulta.error)}
        onReintentar={() => void consulta.refetch()}
      />
    );
  }
  if (consulta.isPending) {
    return (
      <div className={styles.rejilla} aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} alto="bloque" />
        ))}
      </div>
    );
  }
  const estadisticas = consulta.data;
  return (
    <div className={styles.rejilla}>
      <CobradoPorMes estadisticas={estadisticas} ancha />
      <CuentasPorEstado estadisticas={estadisticas} />
      <AccesosPorDia estadisticas={estadisticas} ancha />
      <CuentasPorPlan estadisticas={estadisticas} />
      <AltasPorMes estadisticas={estadisticas} ancha />
    </div>
  );
}
