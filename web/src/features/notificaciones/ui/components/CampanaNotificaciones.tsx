import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatearNumero } from '../../../../l10n/formatos';
import { Icono } from '../../../../shared/ui/atoms/Icono';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { useContadorDeNotificaciones } from '../../application/useNotificaciones';
import { nuevasDesde } from '../../domain/notificacion';
import { BandejaDeNotificaciones } from './BandejaDeNotificaciones';
import styles from './CampanaNotificaciones.module.css';

interface Props {
  /** Quien puede gestionar la bandeja (leer, descartar); el resto solo la mira. */
  puedeGestionar: boolean;
}

/**
 * La campana de la barra: cuántos avisos quedan sin leer y, al abrirla, la bandeja. Si llega un
 * aviso nuevo, se anuncia a los lectores de pantalla sin mover el foco.
 */
export function CampanaNotificaciones({ puedeGestionar }: Props) {
  const { t } = useTranslation('notificaciones');
  const contador = useContadorDeNotificaciones();
  const [abierta, setAbierta] = useState(false);
  const noLeidas = contador.data ?? 0;

  // Se guarda la última lectura y cuántas eran nuevas; con la misma lectura no se vuelve a anunciar.
  const [anuncio, setAnuncio] = useState<{ valor: number | undefined; nuevas: number }>({
    valor: undefined,
    nuevas: 0,
  });
  if (contador.data !== undefined && contador.data !== anuncio.valor) {
    setAnuncio({ valor: contador.data, nuevas: nuevasDesde(anuncio.valor, contador.data) });
  }

  return (
    <span className={styles.envoltorio}>
      <button
        type="button"
        className={styles.campana}
        aria-haspopup="dialog"
        aria-label={t('campana', { count: noLeidas })}
        title={t('titulo')}
        onClick={() => {
          setAbierta(true);
        }}
      >
        <Icono nombre={noLeidas > 0 ? 'notifications_active' : 'notifications'} />
        {noLeidas > 0 ? (
          <span className={styles.contador}>
            <TextoMono>{formatearNumero(noLeidas)}</TextoMono>
          </span>
        ) : null}
      </button>
      <span role="status" className={styles.soloLector}>
        {anuncio.nuevas > 0 ? t('nuevas', { count: anuncio.nuevas }) : ''}
      </span>
      {abierta ? (
        <BandejaDeNotificaciones
          puedeGestionar={puedeGestionar}
          onCerrar={() => {
            setAbierta(false);
          }}
        />
      ) : null}
    </span>
  );
}
