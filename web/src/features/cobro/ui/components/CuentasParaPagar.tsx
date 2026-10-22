import { useTranslation } from 'react-i18next';
import { Skeleton } from '../../../../shared/ui/atoms/Skeleton';
import { useCuentasDeCobro } from '../../application/useCobro';
import type { MetodoDeCobro } from '../../domain/cuentaDeCobro';
import { TarjetaCuentaDeCobro } from './TarjetaCuentaDeCobro';
import styles from './CuentasParaPagar.module.css';

/**
 * Dónde puede pagar la cuenta que se activa: las cuentas bancarias o los QR de AGROCOM que están activos, según
 * el medio elegido (ADR 0029). No muestra nada para el efectivo ni si no hay ninguna cargada.
 */
export function CuentasParaPagar({ metodo }: { metodo: MetodoDeCobro }) {
  const { t } = useTranslation('cobro');
  const cuentas = useCuentasDeCobro();
  if (cuentas.isPending) return <Skeleton alto="bloque" />;
  // Sin permiso o sin red no se muestra nada: registrar el pago no depende de esta ayuda.
  if (cuentas.isError) return null;
  // Si la lista no carga, el pago se puede registrar igual: esto es solo una ayuda para quien cobra.
  const delMetodo = cuentas.data.filter((c) => c.activo && c.metodo === metodo);
  if (delMetodo.length === 0) {
    return <p className={styles.vacio}>{t('paraPagarVacio.' + metodo)}</p>;
  }
  return (
    <section className={styles.contenedor} aria-label={t('paraPagar')}>
      <p className={styles.titulo}>{t('paraPagar')}</p>
      <div className={styles.rejilla}>
        {delMetodo.map((cuenta) => (
          <TarjetaCuentaDeCobro key={cuenta.id} cuenta={cuenta} />
        ))}
      </div>
    </section>
  );
}
