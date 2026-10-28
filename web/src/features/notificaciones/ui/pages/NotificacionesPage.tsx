import { useTranslation } from 'react-i18next';
import { EncabezadoPagina } from '../../../../shared/ui/molecules/EncabezadoPagina';
import { tienePermiso, useSesion } from '../../../seguridad';
import { ListaDeNotificaciones } from '../components/ListaDeNotificaciones';

/**
 * Pantalla completa de avisos de AGROCOM: la misma lista que la campana, con su filtro por tipo. Quien solo
 * mira no ve leer ni descartar (la API lo exige igual).
 */
export function NotificacionesPage() {
  const { t } = useTranslation('notificaciones');
  const { sesion } = useSesion();
  const puedeGestionar = tienePermiso(
    sesion?.permisos ?? [],
    'notificaciones.aviso_plataforma.gestionar',
  );
  return (
    <>
      <EncabezadoPagina titulo={t('pagina.titulo')} subtitulo={t('subtitulo')} />
      <ListaDeNotificaciones puedeGestionar={puedeGestionar} />
    </>
  );
}
