import { useTranslation } from 'react-i18next';
import { formatearNumero, formatearPorcentaje } from '../../../../l10n/formatos';
import { cx } from '../../../../shared/lib/cx';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { anchoDeBarra, type ConsumoDeCuenta } from '../../domain/consumo';
import styles from './BarraDeBolsa.module.css';

/**
 * Consumo de la bolsa como barra de progreso. Es un `progressbar` con nombre y el valor en texto
 * (`aria-valuetext`), así que un lector de pantalla dice «85 de 100 QR» sin depender del color.
 * Sin bolsa no hay barra que dibujar: solo la cifra.
 */
export function BarraDeBolsa({ consumo }: { consumo: ConsumoDeCuenta }) {
  const { t } = useTranslation('limites');
  const usado = formatearNumero(consumo.usado);
  if (consumo.tope === null) {
    return <TextoMono>{t('barra.sinTope', { usado })}</TextoMono>;
  }
  const ancho = anchoDeBarra(consumo.porcentaje);
  const texto = t('barra.valor', {
    usado,
    tope: formatearNumero(consumo.tope),
    porcentaje: formatearPorcentaje(consumo.porcentaje ?? 0),
  });
  return (
    <div className={styles.contenedor}>
      <span
        className={styles.pista}
        role="progressbar"
        aria-label={t('barra.etiqueta', { cuenta: consumo.cuenta.nombre })}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ancho)}
        aria-valuetext={texto}
      >
        <span
          className={cx(styles.relleno, styles[consumo.estado])}
          style={{ width: `${String(ancho)}%` }}
        />
      </span>
      <TextoMono>{texto}</TextoMono>
    </div>
  );
}
