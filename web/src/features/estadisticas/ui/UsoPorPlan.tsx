import { useTranslation } from 'react-i18next';
import { formatearMonto, formatearNumero } from '../../../l10n/formatos';
import { codigoDe } from '../../../shared/api/errorApi';
import { Skeleton } from '../../../shared/ui/atoms/Skeleton';
import { TextoMono } from '../../../shared/ui/atoms/TextoMono';
import { EstadoError } from '../../../shared/ui/organisms/EstadoError';
import { usePlanes } from '../../planes';
import styles from './UsoPorPlan.module.css';

/** Cuántas cuentas tiene cada plan y cuántos usuarios usan: lo que antes se veía en cada tarjeta de Planes. */
export function UsoPorPlan() {
  const { t } = useTranslation('estadisticas');
  const planes = usePlanes();
  if (planes.isError) {
    return (
      <EstadoError
        titulo={t('errorCarga')}
        code={codigoDe(planes.error)}
        onReintentar={() => void planes.refetch()}
      />
    );
  }
  if (planes.isPending) return <Skeleton alto="bloque" />;
  return (
    <section className={styles.tarjeta} aria-labelledby="uso-por-plan">
      <header>
        <h2 id="uso-por-plan" className={styles.titulo}>
          {t('usoTitulo')}
        </h2>
        <p className={styles.subtitulo}>{t('usoSubtitulo')}</p>
      </header>
      <table className={styles.tabla}>
        <thead>
          <tr>
            <th scope="col">{t('plan')}</th>
            <th scope="col" className={styles.numero}>
              {t('cuentas')}
            </th>
            <th scope="col" className={styles.numero}>
              {t('usuariosEnUso')}
            </th>
            <th scope="col" className={styles.numero}>
              {t('precioAnual')}
            </th>
          </tr>
        </thead>
        <tbody>
          {planes.data.map((plan) => (
            <tr key={plan.id}>
              <th scope="row">{plan.nombre}</th>
              <td className={styles.numero}>
                <TextoMono>{formatearNumero(plan.cuentas)}</TextoMono>
              </td>
              <td className={styles.numero}>
                <TextoMono>{formatearNumero(plan.usuariosEnUso)}</TextoMono>
              </td>
              <td className={styles.numero}>
                <TextoMono>{formatearMonto(plan.precioAnual)}</TextoMono>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
