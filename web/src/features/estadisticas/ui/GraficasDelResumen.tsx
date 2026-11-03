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

/** Las gráficas de una pestaña de Estadísticas: cobros y planes, cuentas o accesos. */
export type GrupoDeGraficas = 'cobros' | 'cuentas' | 'accesos';

/**
 * Las gráficas del Resumen (A02) de un grupo (`cobros`: cobrado por mes y cuentas por plan; `cuentas`: por estado
 * y altas por mes; `accesos`: lecturas por día). Los tres grupos comparten la misma consulta, así que cambiar de
 * pestaña no vuelve a pedir nada.
 */
export function GraficasDelResumen({ grupo }: { grupo: GrupoDeGraficas }) {
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
        {[0, 1].map((i) => (
          <Skeleton key={i} alto="bloque" />
        ))}
      </div>
    );
  }
  const estadisticas = consulta.data;
  return (
    <div className={styles.rejilla}>
      {grupo === 'cobros' ? (
        <>
          <CobradoPorMes estadisticas={estadisticas} ancha />
          <CuentasPorPlan estadisticas={estadisticas} />
        </>
      ) : null}
      {grupo === 'cuentas' ? (
        <>
          <CuentasPorEstado estadisticas={estadisticas} />
          <AltasPorMes estadisticas={estadisticas} ancha />
        </>
      ) : null}
      {grupo === 'accesos' ? <AccesosPorDia estadisticas={estadisticas} ancha /> : null}
    </div>
  );
}
