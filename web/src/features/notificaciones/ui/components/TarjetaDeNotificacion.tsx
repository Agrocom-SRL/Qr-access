import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { formatearFecha, formatearHora, relacionDeDia } from '../../../../l10n/formatos';
import { AccesoBadge, type TonoBadge } from '../../../../shared/ui/atoms/AccesoBadge';
import { BotonIcono } from '../../../../shared/ui/atoms/BotonIcono';
import type { NombreIcono } from '../../../../shared/ui/atoms/iconos';
import {
  type Notificacion,
  type PlacaDeNotificacion,
  type Severidad,
} from '../../domain/notificacion';
import { lineasDeAviso } from '../lineasDeAviso';
import styles from './TarjetaDeNotificacion.module.css';

/** Tono e ícono de cada severidad; el texto de la severidad siempre va con ellos. */
const ESTILO: Readonly<Record<Severidad, { tono: TonoBadge; icono: NombreIcono }>> = {
  info: { tono: 'informacion', icono: 'info' },
  aviso: { tono: 'advertencia', icono: 'warning' },
  critica: { tono: 'peligro', icono: 'error' },
};

/** Hoy o ayer con la hora; si no, la fecha completa con la hora (zona de La Paz). */
function cuandoDe(fecha: Date, t: TFunction): string {
  const hora = formatearHora(fecha);
  const dia = relacionDeDia(fecha);
  if (dia === 'hoy') return `${t('comun:hoy')} ${hora}`;
  if (dia === 'ayer') return `${t('comun:ayer')} ${hora}`;
  return `${formatearFecha(fecha)} ${hora}`;
}

interface Linea {
  clave: string;
  texto: string;
}

interface Props {
  notificacion: Notificacion;
  /** Leer y descartar son de quien gestiona la bandeja; quien solo mira no los ve. */
  puedeGestionar: boolean;
  onLeer: () => void;
  onDescartar: () => void;
}

/** Un aviso: qué pasó, con qué puerta, cuándo y las acciones de leerlo o descartarlo. */
export function TarjetaDeNotificacion({
  notificacion,
  puedeGestionar,
  onLeer,
  onDescartar,
}: Props) {
  const { t, i18n } = useTranslation(['notificaciones', 'eventos', 'comun', 'senales']);
  const lineasDelAviso = lineasDeAviso(notificacion, t, i18n.language);
  const { tono, icono } = ESTILO[notificacion.severidad];
  const etiquetaId = `aviso-${notificacion.id}`;

  const detalle = (placa: PlacaDeNotificacion): Linea[] => {
    const lineas: Linea[] = [];
    if (placa.fallos !== null) {
      lineas.push({
        clave: 'fallos',
        texto: t('notificaciones:detalle.aperturasFallidas', { count: placa.fallos }),
      });
    }
    if (placa.causa !== null) {
      lineas.push({ clave: 'causa', texto: t(`notificaciones:causa.${placa.causa}`) });
    }
    if (placa.desde !== null) {
      lineas.push({
        clave: 'desde',
        texto: t('notificaciones:detalle.desde', { cuando: cuandoDe(placa.desde, t) }),
      });
    }
    return lineas;
  };

  return (
    <article className={styles.tarjeta} aria-labelledby={etiquetaId}>
      <div className={styles.cabecera}>
        <AccesoBadge tono={tono} icono={icono}>
          {t(`notificaciones:severidad.${notificacion.severidad}`)}
        </AccesoBadge>
        {notificacion.leida ? null : (
          <AccesoBadge tono="informacion" icono="notifications">
            {t('notificaciones:sinLeer')}
          </AccesoBadge>
        )}
        <span className={styles.suave}>
          {t('notificaciones:novedad', { cuando: cuandoDe(notificacion.novedadEn, t) })}
        </span>
      </div>
      <h4 id={etiquetaId} className={styles.titulo}>
        {t(`notificaciones:tipo.${notificacion.tipo.replaceAll('.', '_')}`)}
      </h4>
      {notificacion.placas.length === 0 ? null : (
        <ul className={styles.placas}>
          {notificacion.placas.map((placa) => (
            <li key={placa.dispositivoId} className={styles.placa}>
              <strong>{placa.puertaNombre}</strong>
              {detalle(placa).map((linea) => (
                <span key={linea.clave} className={styles.suave}>
                  {linea.texto}
                </span>
              ))}
            </li>
          ))}
        </ul>
      )}
      {lineasDelAviso.length === 0 ? null : (
        <ul className={styles.placas}>
          {lineasDelAviso.map((linea, indice) => (
            <li key={indice} className={styles.placa}>
              <span className={styles.suave}>{linea}</span>
            </li>
          ))}
        </ul>
      )}
      {puedeGestionar ? (
        <div className={styles.acciones}>
          {notificacion.leida ? null : (
            <BotonIcono
              icono="mark_email_read"
              accion="ver"
              etiqueta={t('notificaciones:leer')}
              onClick={onLeer}
            />
          )}
          <BotonIcono
            icono="delete"
            accion="eliminar"
            etiqueta={t('notificaciones:descartar')}
            onClick={onDescartar}
          />
        </div>
      ) : null}
    </article>
  );
}
