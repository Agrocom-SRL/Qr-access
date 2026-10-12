import { useTranslation } from 'react-i18next';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { Icono } from '../../../../shared/ui/atoms/Icono';
import { PinUnaVez } from '../../../../shared/ui/organisms/PinUnaVez';
import styles from './CuentaCreadaPantalla.module.css';

interface Props {
  cuenta: string;
  administrador: string;
  /** El PIN en claro: solo vive en el estado de la página que lo recibió. */
  pin: string;
  onIrALaCuenta: () => void;
}

/** A04e: pantalla completa con el PIN inicial, que no se vuelve a mostrar. */
export function CuentaCreadaPantalla({ cuenta, administrador, pin, onIrALaCuenta }: Props) {
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
          <p className={styles.subtitulo}>{t('creadaTexto', { cuenta })}</p>
        </div>
        <PinUnaVez
          titulo={t('pinDe', { nombre: administrador })}
          pin={pin}
          aviso={t('pinUnaVez')}
        />
        <AccesoBoton bloque onClick={onIrALaCuenta}>
          {t('irCuenta')}
        </AccesoBoton>
      </section>
    </div>
  );
}
