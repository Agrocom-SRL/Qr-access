import { useTranslation } from 'react-i18next';
import { formatearMonto } from '../../../../l10n/formatos';
import { TarjetaGrafica } from '../../../../shared/ui/organisms/TarjetaGrafica';
import type { Cobranza } from '../../domain/pago';
import styles from './PorCobrar.module.css';

interface Tramo {
  id: 'proximos30' | 'de31a90' | 'porActivar' | 'vencido';
  /** Variable CSS del color del tramo. */
  color: string;
  monto: number;
  cuentas: number;
}

/**
 * Lo que falta cobrar, separado en cuatro tramos que no se pisan: lo que vence en 30 días, lo que
 * vence entre 31 y 90, las cuentas nuevas sin su primer pago y lo vencido. Barras horizontales
 * con el monto y las cuentas escritos al final de cada una.
 */
export function PorCobrar({ totales }: { totales: Cobranza['totales'] }) {
  const { t, i18n } = useTranslation('estadisticas');
  const idioma = i18n.language;
  const tramos: Tramo[] = [
    {
      id: 'proximos30',
      color: 'var(--primario)',
      monto: totales.porCobrar30.monto,
      cuentas: totales.porCobrar30.cuentas,
    },
    {
      id: 'de31a90',
      color: 'var(--informacion)',
      monto: totales.porCobrar90.monto - totales.porCobrar30.monto,
      cuentas: totales.porCobrar90.cuentas - totales.porCobrar30.cuentas,
    },
    {
      id: 'porActivar',
      color: 'var(--advertencia)',
      monto: totales.porActivar.monto,
      cuentas: totales.porActivar.cuentas,
    },
    {
      id: 'vencido',
      color: 'var(--peligro)',
      monto: totales.vencidoSinPagar.monto,
      cuentas: totales.vencidoSinPagar.cuentas,
    },
  ];
  const mayor = Math.max(1, ...tramos.map((tramo) => tramo.monto));
  return (
    <TarjetaGrafica
      titulo={t('porCobrarTitulo')}
      subtitulo={t('porCobrarSubtitulo')}
      tabla={{
        encabezados: [t('tramo'), t('monto'), t('cuentas')],
        filas: tramos.map((tramo) => [
          t(`tramos.${tramo.id}`),
          formatearMonto(tramo.monto, idioma),
          tramo.cuentas,
        ]),
      }}
    >
      <ul className={styles.barras}>
        {tramos.map((tramo) => (
          <li key={tramo.id} className={styles.fila}>
            <span className={styles.etiqueta}>{t(`tramos.${tramo.id}`)}</span>
            <span className={styles.pista}>
              <span
                className={styles.relleno}
                style={{
                  width: `${String((tramo.monto / mayor) * 100)}%`,
                  background: tramo.color,
                }}
              />
            </span>
            <strong className={styles.valor}>
              {formatearMonto(tramo.monto, idioma)}
              <span className={styles.cuentas}>
                {t('cuentasDelTramo', { count: tramo.cuentas })}
              </span>
            </strong>
          </li>
        ))}
      </ul>
    </TarjetaGrafica>
  );
}
