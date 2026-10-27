import { useTranslation } from 'react-i18next';
import { formatearFecha, formatearHora } from '../../../../l10n/formatos';
import { AccesoBadge } from '../../../../shared/ui/atoms/AccesoBadge';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import { TONO_DE_ESTADO, TONO_DE_GRAVEDAD, type Incidente } from '../../domain/incidente';
import styles from './DialogoDetalleIncidente.module.css';

interface Props {
  incidente: Incidente;
  onCerrar: () => void;
}

function cuandoDe(fecha: Date): string {
  return `${formatearFecha(fecha)} ${formatearHora(fecha)}`;
}

/**
 * El detalle de un incidente: quién, qué, cuándo, la evidencia en cifras y la resolución si la hay. Solo se
 * consulta: nada de lo que muestra se edita desde aquí (la API de plataforma no resuelve incidentes).
 */
export function DialogoDetalleIncidente({ incidente, onCerrar }: Props) {
  const { t } = useTranslation(['incidentes', 'comun']);
  const usuario = incidente.usuario.etiqueta ?? t('incidentes:sinUsuario');
  const evidencia = incidente.evidencia;

  return (
    <Dialogo
      abierto
      titulo={t('incidentes:detalle.titulo', { usuario })}
      onCerrar={onCerrar}
      ancho="ancho"
    >
      <p className={styles.aviso}>{t('incidentes:detalle.soloLectura')}</p>
      <div className={styles.insignias}>
        <AccesoBadge tono={TONO_DE_GRAVEDAD[incidente.gravedad]}>
          {t(`incidentes:gravedad.${incidente.gravedad}`)}
        </AccesoBadge>
        <AccesoBadge tono={TONO_DE_ESTADO[incidente.estado]}>
          {t(`incidentes:estado.${incidente.estado}`)}
        </AccesoBadge>
      </div>
      <dl className={styles.datos}>
        <dt>{t('incidentes:detalle.usuario')}</dt>
        <dd>{usuario}</dd>
        <dt>{t('incidentes:detalle.tipo')}</dt>
        <dd>{t(`incidentes:tipo.${incidente.tipo}`)}</dd>
        <dt>{t('incidentes:detalle.origen')}</dt>
        <dd>
          {t(`incidentes:origen.${incidente.origen}`)}
          {incidente.registradoPor ? (
            <span className={styles.suave}>
              {' · '}
              {t('incidentes:detalle.registradoPor', {
                persona: incidente.registradoPor.etiqueta ?? t('incidentes:sinUsuario'),
              })}
            </span>
          ) : null}
        </dd>
        <dt>{t('incidentes:detalle.ocurrido')}</dt>
        <dd>
          <TextoMono>{cuandoDe(incidente.ocurridoEn)}</TextoMono>
        </dd>
        <dt>{t('incidentes:detalle.descripcion')}</dt>
        {/* Texto plano: lo escribió una persona o el sistema, y se muestra tal cual, nunca como HTML. */}
        <dd>{incidente.descripcion ?? t('incidentes:detalle.sinDescripcion')}</dd>
        <dt>{t('incidentes:detalle.evidencia')}</dt>
        <dd>
          {t('incidentes:detalle.evidenciaCifras', {
            qr: evidencia.qrIds.length,
            accesos: evidencia.eventoAccesoIds.length,
            limites: evidencia.eventoLimiteIds.length,
          })}
        </dd>
        <dt>{t('incidentes:detalle.resolucion')}</dt>
        <dd>
          {incidente.resolucion === null ? (
            t('incidentes:detalle.sinResolver')
          ) : (
            <span className={styles.resolucion}>
              <strong>{t(`incidentes:estado.${incidente.resolucion.resultado}`)}</strong>
              <span className={styles.suave}>
                {t('incidentes:detalle.resueltoPor', {
                  persona: incidente.resolucion.resueltoPor.etiqueta ?? t('incidentes:sinUsuario'),
                  cuando: cuandoDe(incidente.resolucion.resueltaEn),
                })}
              </span>
              <span>{incidente.resolucion.motivo ?? t('incidentes:detalle.sinMotivo')}</span>
            </span>
          )}
        </dd>
      </dl>
    </Dialogo>
  );
}
