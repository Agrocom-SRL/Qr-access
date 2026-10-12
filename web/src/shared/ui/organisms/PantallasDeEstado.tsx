import { useTranslation } from 'react-i18next';
import { AccesoBoton } from '../atoms/AccesoBoton';
import { EstadoVacio } from './EstadoVacio';
import { PantallaCompleta } from './PantallaCompleta';

interface PropsBase {
  incrustada?: boolean;
}

/** PE5b: sin conexión y sin nada en caché. */
export function PantallaSinConexion({
  onReintentar,
  incrustada,
}: PropsBase & { onReintentar: () => void }) {
  const { t } = useTranslation('comun');
  return (
    <PantallaCompleta incrustada={incrustada}>
      <EstadoVacio
        ilustracion="sinConexion"
        titulo={t('sinConexionTotal.titulo')}
        texto={t('sinConexionTotal.texto')}
        accion={
          <AccesoBoton icono="refresh" onClick={onReintentar}>
            {t('reintentar')}
          </AccesoBoton>
        }
      />
    </PantallaCompleta>
  );
}

/** PE5c: la API cortó la sesión (refresco fallido). */
export function PantallaSesionVencida({
  onIngresar,
  incrustada,
}: PropsBase & { onIngresar: () => void }) {
  const { t } = useTranslation(['auth', 'comun']);
  return (
    <PantallaCompleta incrustada={incrustada}>
      <EstadoVacio
        ilustracion="bloqueo"
        titulo={t('auth:sesionVencida.titulo')}
        texto={t('auth:sesionVencida.texto')}
        codigo="AUTH_SESION_VENCIDA"
        accion={<AccesoBoton onClick={onIngresar}>{t('auth:ingresar')}</AccesoBoton>}
      />
    </PantallaCompleta>
  );
}

/** Ruta que no existe: vuelve al inicio del panel. */
export function PantallaNoEncontrada({
  onVolver,
  incrustada,
}: PropsBase & { onVolver: () => void }) {
  const { t } = useTranslation('comun');
  return (
    <PantallaCompleta incrustada={incrustada}>
      <EstadoVacio
        ilustracion="vacioQr"
        titulo={t('noEncontrada.titulo')}
        texto={t('noEncontrada.texto')}
        codigo="404"
        accion={<AccesoBoton onClick={onVolver}>{t('noEncontrada.volver')}</AccesoBoton>}
      />
    </PantallaCompleta>
  );
}
