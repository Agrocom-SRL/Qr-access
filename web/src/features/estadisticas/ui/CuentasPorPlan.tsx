import { useTranslation } from 'react-i18next';
import { formatearNumero } from '../../../l10n/formatos';
import { TarjetaGrafica } from '../../../shared/ui/organisms/TarjetaGrafica';
import type { Estadisticas } from '../domain/estadisticas';
import styles from './Graficas.module.css';

/** Cuántas cuentas tiene cada plan: barras horizontales de un solo color, con la cifra al final de cada una. */
export function CuentasPorPlan({ estadisticas }: { estadisticas: Estadisticas }) {
  const { t, i18n } = useTranslation('estadisticas');
  const idioma = i18n.language;
  const planes = estadisticas.cuentasPorPlan;
  const mayor = Math.max(1, ...planes.map((p) => p.cuentas));
  return (
    <TarjetaGrafica
      titulo={t('planesTitulo')}
      subtitulo={t('planesSubtitulo')}
      tabla={{
        encabezados: [t('plan'), t('cuentas')],
        filas: planes.map((p) => [p.plan, p.cuentas]),
      }}
    >
      {planes.length === 0 ? (
        <p className={styles.vacio}>{t('sinCuentas')}</p>
      ) : (
        <ul className={styles.barras}>
          {planes.map((p) => (
            <li key={p.plan} className={styles.fila}>
              <span className={styles.etiquetaDeBarra}>{p.plan}</span>
              <span className={styles.pista}>
                <span
                  className={styles.relleno}
                  style={{ width: `${String((p.cuentas / mayor) * 100)}%` }}
                />
              </span>
              <strong className={styles.cifra}>{formatearNumero(p.cuentas, idioma)}</strong>
            </li>
          ))}
        </ul>
      )}
    </TarjetaGrafica>
  );
}
