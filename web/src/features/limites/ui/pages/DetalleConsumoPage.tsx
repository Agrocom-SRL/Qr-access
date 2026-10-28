import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
  formatearFecha,
  formatearHora,
  formatearMes,
  formatearNumero,
  formatearPorcentaje,
  formatearDiaCalendario,
} from '../../../../l10n/formatos';
import { codigoDe } from '../../../../shared/api/errorApi';
import { EncabezadoPagina } from '../../../../shared/ui/molecules/EncabezadoPagina';
import { EstadoError } from '../../../../shared/ui/organisms/EstadoError';
import { TarjetaGrafica } from '../../../../shared/ui/organisms/TarjetaGrafica';
import { TarjetaIndicador } from '../../../../shared/ui/organisms/TarjetaIndicador';
import { Spinner } from '../../../../shared/ui/atoms/Spinner';
import { useConsumoDeCuenta } from '../../application/useLimites';
import type { DetalleDeConsumo } from '../../domain/consumo';
import { BarraDeBolsa } from '../components/BarraDeBolsa';
import { EstadoDeBolsa } from '../components/EstadoDeBolsa';
import { GraficoDeConsumoDiario } from '../components/GraficoDeConsumoDiario';
import styles from './DetalleConsumoPage.module.css';

/** Fecha y hora de una marca del consumo (aviso o superación), en la zona de La Paz. */
function cuandoDe(fecha: Date): string {
  return `${formatearFecha(fecha)} ${formatearHora(fecha)}`;
}

/**
 * El consumo de la bolsa de una cuenta: cuánto lleva del mes, de dónde sale su tope y la serie de
 * QR generados por día. La pantalla informa; no hay acción que corte ni limite a la cuenta.
 */
export function DetalleConsumoPage() {
  const { t } = useTranslation(['limites', 'comun']);
  const { id = '' } = useParams();
  const consulta = useConsumoDeCuenta(id);

  if (consulta.isError) {
    return (
      <>
        <EncabezadoPagina titulo={t('limites:pestana')} />
        <EstadoError
          titulo={t('limites:detalle.errorCarga')}
          code={codigoDe(consulta.error)}
          onReintentar={() => {
            void consulta.refetch();
          }}
        />
      </>
    );
  }
  if (consulta.data === undefined) {
    return (
      <div className={styles.cargando} role="status" aria-label={t('comun:cargando')}>
        <Spinner />
      </div>
    );
  }
  return <Detalle detalle={consulta.data} />;
}

function Detalle({ detalle }: { detalle: DetalleDeConsumo }) {
  const { t, i18n } = useTranslation(['limites', 'comun']);
  const idioma = i18n.language;
  const { cuenta } = detalle;
  const origen =
    detalle.origenDelTope === null
      ? t('comun:sinDato')
      : t(`limites:origen.${detalle.origenDelTope}`);
  const subtitulo = detalle.plan
    ? `${cuenta.codigo} · ${t('limites:detalle.plan', { plan: detalle.plan })}`
    : `${cuenta.codigo} · ${t('limites:sinPlan')}`;

  return (
    <>
      <EncabezadoPagina titulo={cuenta.nombre} subtitulo={subtitulo} />
      <section className={styles.indicadores} aria-label={t('limites:pestana')}>
        <TarjetaIndicador
          etiqueta={t('limites:detalle.usado')}
          valor={formatearNumero(detalle.usado, idioma)}
          detalle={t('limites:mes', { mes: formatearMes(detalle.mes, idioma) })}
        />
        <TarjetaIndicador
          etiqueta={t('limites:detalle.tope')}
          valor={
            detalle.tope === null
              ? t('limites:detalle.sinTope')
              : formatearNumero(detalle.tope, idioma)
          }
          detalle={t('limites:detalle.origen', { origen })}
        />
        <TarjetaIndicador
          etiqueta={t('limites:detalle.porcentaje')}
          valor={
            detalle.porcentaje === null
              ? t('comun:sinDato')
              : formatearPorcentaje(detalle.porcentaje, idioma)
          }
        >
          <div className={styles.estado}>
            <EstadoDeBolsa estado={detalle.estado} />
            <BarraDeBolsa consumo={detalle} />
          </div>
          {detalle.avisoEn ? (
            <p className={styles.marca}>
              {t('limites:detalle.avisoEl', { cuando: cuandoDe(detalle.avisoEn) })}
            </p>
          ) : null}
          {detalle.superadaEn ? (
            <p className={styles.marca}>
              {t('limites:detalle.superadaEl', { cuando: cuandoDe(detalle.superadaEn) })}
            </p>
          ) : null}
        </TarjetaIndicador>
      </section>
      <TarjetaGrafica
        ancha
        titulo={t('limites:detalle.graficaTitulo')}
        subtitulo={t('limites:detalle.graficaSubtitulo', {
          mes: formatearMes(detalle.mes, idioma),
          total: formatearNumero(detalle.usado, idioma),
        })}
        tabla={{
          encabezados: [t('limites:detalle.dia'), t('limites:detalle.generados')],
          filas: detalle.serie.map((fila) => [
            formatearDiaCalendario(fila.dia, idioma),
            fila.generados,
          ]),
        }}
      >
        <GraficoDeConsumoDiario
          serie={detalle.serie}
          etiqueta={t('limites:detalle.graficaEtiqueta', { cuenta: cuenta.nombre })}
        />
      </TarjetaGrafica>
    </>
  );
}
