import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AccesoBadge } from '../../../../shared/ui/atoms/AccesoBadge';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import type { CuentaDeCobro } from '../../domain/cuentaDeCobro';
import { ImagenDeCobro } from './ImagenDeCobro';
import styles from './TarjetaCuentaDeCobro.module.css';

interface Props {
  cuenta: CuentaDeCobro;
  /** Acciones al pie (editar, activar, eliminar); sin ellas la tarjeta es solo informativa. */
  acciones?: ReactNode;
}

/** Una cuenta donde AGROCOM recibe pagos: banco, titular y número, o el QR de cobro. */
export function TarjetaCuentaDeCobro({ cuenta, acciones }: Props) {
  const { t } = useTranslation('cobro');
  return (
    <article className={styles.tarjeta} aria-label={cuenta.banco}>
      <header className={styles.cabecera}>
        <h2 className={styles.banco}>{cuenta.banco}</h2>
        <AccesoBadge tono={cuenta.activo ? 'primario' : 'neutro'}>
          {cuenta.activo ? t('metodos.' + cuenta.metodo) : t('inactiva')}
        </AccesoBadge>
      </header>
      {cuenta.metodo === 'transferencia' ? (
        <dl className={styles.datos}>
          <div>
            <dt>{t('titular')}</dt>
            <dd>{cuenta.titular}</dd>
          </div>
          <div>
            <dt>{t('numeroCuenta')}</dt>
            <dd>
              <TextoMono fuerte>{cuenta.numeroCuenta}</TextoMono>
              {cuenta.tipoCuenta ? ` · ${t(`tipos.${cuenta.tipoCuenta}`)}` : ''}
            </dd>
          </div>
        </dl>
      ) : cuenta.imagenId !== null ? (
        <ImagenDeCobro imagenId={cuenta.imagenId} banco={cuenta.banco} />
      ) : null}
      {cuenta.nota ? <p className={styles.nota}>{cuenta.nota}</p> : null}
      {acciones ? <footer className={styles.acciones}>{acciones}</footer> : null}
    </article>
  );
}
