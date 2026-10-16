import { useTranslation } from 'react-i18next';
import { formatearFecha, formatearHora } from '../../../../l10n/formatos';
import { AccesoBadge } from '../../../../shared/ui/atoms/AccesoBadge';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import type { EventoBitacora, ValoresDeEvento } from '../../domain/evento';
import { describirEvento } from '../describirEvento';
import styles from './DialogoDetalleEvento.module.css';

const VACIO = '—';
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** Un valor tal como lo lee una persona: fechas en la zona de la plataforma, vacío como raya. */
function valorLegible(valor: ValoresDeEvento[string] | undefined): string {
  if (valor === null || valor === undefined || valor === '') return VACIO;
  if (typeof valor === 'string' && FECHA_ISO.test(valor)) {
    return `${formatearFecha(valor)} ${formatearHora(valor)}`;
  }
  return String(valor);
}

/** Cada campo que aparece antes o después, en el orden en que llegó. */
function camposDe(evento: EventoBitacora): string[] {
  return [...new Set([...Object.keys(evento.antes ?? {}), ...Object.keys(evento.despues ?? {})])];
}

interface Props {
  evento: EventoBitacora | null;
  onCerrar: () => void;
}

/** El evento completo: quién, cuándo y desde dónde, y campo por campo qué cambió (sin recortes). */
export function DialogoDetalleEvento({ evento, onCerrar }: Props) {
  const { t } = useTranslation('bitacora');
  const campos = evento ? camposDe(evento) : [];
  const descrito = evento ? describirEvento(evento, t) : null;
  return (
    <Dialogo
      abierto={evento !== null}
      titulo={descrito?.que ?? t('detalle.titulo')}
      ancho="ancho"
      onCerrar={onCerrar}
      acciones={<AccesoBoton onClick={onCerrar}>{t('detalle.cerrar')}</AccesoBoton>}
    >
      {evento ? (
        <>
          <dl className={styles.resumen}>
            <div>
              <dt>{t('columna.cuando')}</dt>
              <dd>
                <TextoMono>{`${formatearFecha(evento.ocurridoEn)} ${formatearHora(evento.ocurridoEn)}`}</TextoMono>
              </dd>
            </div>
            <div>
              <dt>{t('columna.quien')}</dt>
              <dd>{evento.usuario?.nombre ?? t('sistema')}</dd>
            </div>
            <div>
              <dt>{t('columna.cuenta')}</dt>
              <dd>
                {evento.cuenta ? <TextoMono fuerte>{evento.cuenta.codigo}</TextoMono> : VACIO}
              </dd>
            </div>
            <div>
              <dt>{t('columna.origen')}</dt>
              <dd>{t(`origen.${evento.canal}`)}</dd>
            </div>
          </dl>
          {campos.length === 0 ? (
            <p className={styles.suave}>{t('detalle.sinCampos')}</p>
          ) : (
            <div className={styles.contenedor}>
              <table className={styles.tabla}>
                <thead>
                  <tr>
                    <th scope="col">{t('detalle.campo')}</th>
                    <th scope="col">{t('columna.antes')}</th>
                    <th scope="col">{t('columna.despues')}</th>
                  </tr>
                </thead>
                <tbody>
                  {campos.map((campo) => {
                    const antes = valorLegible(evento.antes?.[campo]);
                    const despues = valorLegible(evento.despues?.[campo]);
                    return (
                      <tr key={campo}>
                        <th scope="row" className={styles.campo}>
                          <TextoMono>{campo}</TextoMono>
                        </th>
                        <td className={styles.suave}>{antes}</td>
                        <td>
                          {despues}
                          {antes !== despues ? (
                            <AccesoBadge tono="advertencia">{t('detalle.cambio')}</AccesoBadge>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </Dialogo>
  );
}
