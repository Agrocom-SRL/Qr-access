import { useTranslation } from 'react-i18next';
import { formatearMonto } from '../../../../l10n/formatos';
import { codigoDe } from '../../../../shared/api/errorApi';
import { Icono } from '../../../../shared/ui/atoms/Icono';
import { Skeleton } from '../../../../shared/ui/atoms/Skeleton';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { EstadoError } from '../../../../shared/ui/organisms/EstadoError';
import { TarjetaPlan } from '../../../../shared/ui/organisms/TarjetaPlan';
import { cx } from '../../../../shared/lib/cx';
import { usePlanes } from '../../../planes';
import styles from './PasoPlan.module.css';

interface Props {
  planId: string | null;
  onElegir: (planId: string) => void;
}

/** A04b: los planes vendibles como tarjetas con selección única (radio accesible). */
export function PasoPlan({ planId, onElegir }: Props) {
  const { t } = useTranslation('crearCuenta');
  const planes = usePlanes();

  if (planes.isError) {
    return (
      <EstadoError
        titulo={t('planesError')}
        code={codigoDe(planes.error)}
        onReintentar={() => void planes.refetch()}
      />
    );
  }
  if (planes.isPending) {
    return (
      <div className={styles.rejilla} aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} alto="bloque" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className={styles.rejilla} role="radiogroup" aria-label={t('planElegido')}>
        {planes.data.map((plan) => {
          const elegido = plan.id === planId;
          return (
            <label key={plan.id} className={styles.opcion}>
              <input
                type="radio"
                name="plan"
                className={styles.entrada}
                checked={elegido}
                onChange={() => {
                  onElegir(plan.id);
                }}
              />
              <TarjetaPlan
                nombre={plan.nombre}
                etiquetaCupo={t('hasta')}
                cupo={t('usuarios', { count: plan.cupoUsuarios ?? 0 })}
                seleccionada={elegido}
                esquina={
                  <span
                    className={cx(styles.radio, elegido && styles.radioActivo)}
                    aria-hidden="true"
                  />
                }
                pie={
                  <ul className={styles.ventajas}>
                    <li>
                      <Icono nombre="all_inclusive" tamano={20} />
                      {t('qrIlimitados')}
                    </li>
                    <li>
                      <Icono nombre="door_front" tamano={20} />
                      {t('sitiosIlimitados')}
                    </li>
                  </ul>
                }
              >
                <div>
                  <p className={styles.precio}>
                    <TextoMono fuerte>{formatearMonto(plan.precioAnual)}</TextoMono>
                  </p>
                  <p className={styles.nota}>{t('alAnio')}</p>
                </div>
              </TarjetaPlan>
            </label>
          );
        })}
      </div>
    </>
  );
}
