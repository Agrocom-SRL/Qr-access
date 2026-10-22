import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccesoBoton } from '../atoms/AccesoBoton';
import { Aviso } from '../molecules/Aviso';
import { cx } from '../../lib/cx';
import styles from './PinUnaVez.module.css';

interface Props {
  /** "PIN de Rodrigo Añez · Administrador" */
  titulo: string;
  /** Los 7 caracteres, en claro: solo viven en este componente mientras se muestran. */
  pin: string;
  /** Texto del aviso "no se vuelve a mostrar". */
  aviso: string;
}

/** El PIN inicial en casillas 3 + 4 en mono 32/600, con "Compartir PIN" y el aviso de que no se repite (A04e). */
export function PinUnaVez({ titulo, pin, aviso }: Props) {
  const { t } = useTranslation('crearCuenta');
  const [resultado, setResultado] = useState<'compartido' | 'copiado' | null>(null);
  const caracteres = Array.from(pin);
  // Hoja de compartir del sistema si el navegador la tiene (igual que la app);
  // si no, se copia al portapapeles. Cancelar la hoja no marca nada.
  const compartir = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text: pin });
        setResultado('compartido');
      } catch {
        // El usuario cerró la hoja sin compartir.
      }
      return;
    }
    await navigator.clipboard.writeText(pin);
    setResultado('copiado');
  };
  return (
    <div className={styles.contenedor}>
      <div className={styles.caja}>
        <p className={styles.titulo}>{titulo}</p>
        <div className={styles.casillas} role="img" aria-label={caracteres.join(' ')}>
          {caracteres.map((caracter, i) => (
            <span key={i} className={cx(styles.casilla, i === 3 && styles.separada)}>
              {caracter}
            </span>
          ))}
        </div>
        <AccesoBoton variante="tonal" icono="share" onClick={() => void compartir()}>
          {resultado ? t(resultado) : t('compartirPin')}
        </AccesoBoton>
      </div>
      <Aviso tono="advertencia" icono="visibility_lock">
        {aviso}
      </Aviso>
    </div>
  );
}
