import { useTranslation } from 'react-i18next';
import { formatearNumero } from '../../../l10n/formatos';
import { Icono } from '../../../shared/ui/atoms/Icono';
import type { NombreIcono } from '../../../shared/ui/atoms/iconos';
import { TarjetaGrafica } from '../../../shared/ui/organisms/TarjetaGrafica';
import { ESTADOS_EN_ORDEN, totalDeCuentas, type Estadisticas } from '../domain/estadisticas';
import type { EstadoDeSuscripcion } from '../../../shared/api/estados';
import styles from './Graficas.module.css';

/** Color (variable CSS) e ícono de cada estado: el tono y el ícono van siempre con el texto. */
const APARIENCIA: Readonly<Record<EstadoDeSuscripcion, { color: string; icono: NombreIcono }>> = {
  activa: { color: 'var(--primario)', icono: 'check_circle' },
  porVencer: { color: 'var(--advertencia)', icono: 'schedule' },
  pendientePago: { color: 'var(--informacion)', icono: 'pending_actions' },
  vencida: { color: 'var(--peligro)', icono: 'event_busy' },
  suspendida: { color: 'var(--textoSecundario)', icono: 'pause_circle' },
};

/**
 * Cómo se reparten las cuentas por estado: una barra horizontal partida (parte de un todo) y,
 * debajo, cada estado con su ícono, su nombre y su cifra. La cifra va en el texto, no en el color.
 */
export function CuentasPorEstado({ estadisticas }: { estadisticas: Estadisticas }) {
  const { t, i18n } = useTranslation(['estadisticas', 'suscripcion']);
  const idioma = i18n.language;
  const estados = estadisticas.cuentasPorEstado;
  const total = totalDeCuentas(estados);
  return (
    <TarjetaGrafica
      titulo={t('estadisticas:estadosTitulo')}
      subtitulo={t('estadisticas:estadosSubtitulo', { count: total })}
      tabla={{
        encabezados: [t('estadisticas:estado'), t('estadisticas:cuentas')],
        filas: ESTADOS_EN_ORDEN.map((e) => [t(`suscripcion:estado.${e}`), estados[e]]),
      }}
    >
      {total === 0 ? (
        <p className={styles.vacio}>{t('estadisticas:sinCuentas')}</p>
      ) : (
        <>
          <div className={styles.partida} role="img" aria-label={t('estadisticas:estadosTitulo')}>
            {ESTADOS_EN_ORDEN.filter((e) => estados[e] > 0).map((e) => (
              <span
                key={e}
                className={styles.tramo}
                style={{ flexGrow: estados[e], background: APARIENCIA[e].color }}
                title={`${t(`suscripcion:estado.${e}`)}: ${formatearNumero(estados[e], idioma)}`}
              />
            ))}
          </div>
          <ul className={styles.estados}>
            {ESTADOS_EN_ORDEN.map((e) => (
              <li key={e} className={styles.estado}>
                <span className={styles.icono} style={{ color: APARIENCIA[e].color }}>
                  <Icono nombre={APARIENCIA[e].icono} tamano={20} />
                </span>
                <span className={styles.nombreEstado}>{t(`suscripcion:estado.${e}`)}</span>
                <strong className={styles.cifra}>{formatearNumero(estados[e], idioma)}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </TarjetaGrafica>
  );
}
