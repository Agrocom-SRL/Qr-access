import { useTranslation } from 'react-i18next';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { Icono } from '../../../../shared/ui/atoms/Icono';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { PinUnaVez } from '../../../../shared/ui/organisms/PinUnaVez';
import styles from './CuentaCreadaPantalla.module.css';

interface Props {
  cuenta: string;
  administrador: string;
  /** El PIN en claro: solo vive en el estado de la página que lo recibió. */
  pin: string;
  /** Sin el primer pago: la cuenta no opera hasta registrarlo. */
  pendientePago: boolean;
  onIrALaCuenta: () => void;
  onRegistrarPago: () => void;
}

/** A04e: pantalla completa con el PIN inicial, que no se vuelve a mostrar. */
export function CuentaCreadaPantalla({
  cuenta,
  administrador,
  pin,
  pendientePago,
  onIrALaCuenta,
  onRegistrarPago,
}: Props) {
  const { t } = useTranslation('crearCuenta');
  return (
    <div className={styles.pantalla}>
      <section className={styles.tarjeta} aria-labelledby="cuenta-creada">
        <span className={styles.exito}>
          <Icono nombre="check_circle" tamano={32} />
        </span>
        <div className={styles.textos}>
          <h1 id="cuenta-creada" className={styles.titulo}>
            {t('creada')}
          </h1>
          <p className={styles.subtitulo}>
            {pendientePago ? t('creadaPendienteTexto', { cuenta }) : t('creadaTexto', { cuenta })}
          </p>
        </div>
        <PinUnaVez
          titulo={t('pinDe', { nombre: administrador })}
          pin={pin}
          aviso={t('pinUnaVez')}
        />
        {pendientePago ? (
          <>
            <Aviso tono="advertencia">{t('creadaPendienteAviso')}</Aviso>
            <AccesoBoton bloque onClick={onRegistrarPago}>
              {t('registrarPagoAhora')}
            </AccesoBoton>
            <AccesoBoton bloque variante="texto" onClick={onIrALaCuenta}>
              {t('irCuenta')}
            </AccesoBoton>
          </>
        ) : (
          <AccesoBoton bloque onClick={onIrALaCuenta}>
            {t('irCuenta')}
          </AccesoBoton>
        )}
      </section>
    </div>
  );
}
