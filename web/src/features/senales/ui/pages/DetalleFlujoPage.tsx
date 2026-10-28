import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  formatearDecimal,
  formatearDiaCalendario,
  formatearNumero,
} from '../../../../l10n/formatos';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBadge } from '../../../../shared/ui/atoms/AccesoBadge';
import { Spinner } from '../../../../shared/ui/atoms/Spinner';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { EncabezadoPagina } from '../../../../shared/ui/molecules/EncabezadoPagina';
import { FiltroSegmentado } from '../../../../shared/ui/molecules/FiltroSegmentado';
import { EstadoError } from '../../../../shared/ui/organisms/EstadoError';
import { TarjetaGrafica } from '../../../../shared/ui/organisms/TarjetaGrafica';
import { TarjetaIndicador } from '../../../../shared/ui/organisms/TarjetaIndicador';
import { useFlujoDeCuenta } from '../../application/useSenales';
import { PERIODOS_DEL_DETALLE, type DetalleDeFlujo } from '../../domain/flujo';
import { GraficoDeFlujo } from '../components/GraficoDeFlujo';
import styles from './DetalleFlujoPage.module.css';

/** El periodo va en la URL (`?dias=`) para que el enlace se pueda compartir; por omisión, 30 días. */
function periodoDeLaUrl(valor: string | null): number {
  return PERIODOS_DEL_DETALLE.find((periodo) => String(periodo) === valor) ?? 30;
}

/**
 * El flujo de una cuenta día por día: aperturas, la base habitual y los días atípicos. Sirve para
 * distinguir un pico de un día de un patrón que se sostiene. Solo informa.
 */
export function DetalleFlujoPage() {
  const { t } = useTranslation(['senales', 'comun']);
  const { id = '' } = useParams();
  const [parametros, setParametros] = useSearchParams();
  const dias = periodoDeLaUrl(parametros.get('dias'));
  const consulta = useFlujoDeCuenta(id, dias);

  const cambiarPeriodo = (valor: string) => {
    setParametros({ dias: valor }, { replace: true });
  };

  const selector = (
    <FiltroSegmentado
      etiqueta={t('senales:periodo')}
      valor={String(dias)}
      onCambio={cambiarPeriodo}
      opciones={PERIODOS_DEL_DETALLE.map((periodo) => ({
        valor: String(periodo),
        etiqueta: t('senales:dias', { count: periodo }),
      }))}
    />
  );

  if (consulta.isError) {
    return (
      <>
        <EncabezadoPagina titulo={t('senales:flujo.titulo')} />
        <EstadoError
          titulo={t('senales:flujo.detalle.errorCarga')}
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
  return <Detalle detalle={consulta.data} selector={selector} />;
}

function Detalle({ detalle, selector }: { detalle: DetalleDeFlujo; selector: ReactNode }) {
  const { t, i18n } = useTranslation('senales');
  const idioma = i18n.language;
  const { cuenta, serie } = detalle;
  // La serie termina hoy: su último día es la foto de la que habla la tarjeta de hoy.
  const hoy = serie.at(-1);
  const diasAtipicos = serie.filter((dia) => dia.atipico).length;
  const baseHoy = hoy?.base ?? null;
  const titulo = t('flujo.detalle.titulo', { cuenta: cuenta.nombre });

  return (
    <>
      <EncabezadoPagina titulo={titulo} subtitulo={cuenta.codigo} />
      <div className={styles.selector}>{selector}</div>
      <section className={styles.indicadores} aria-label={t('flujo.titulo')}>
        <TarjetaIndicador
          etiqueta={t('flujo.detalle.usuariosHoy')}
          valor={formatearNumero(detalle.usuariosActivos, idioma)}
        />
        <TarjetaIndicador
          etiqueta={t('flujo.detalle.aperturasHoy')}
          valor={formatearNumero(hoy?.aperturas ?? 0, idioma)}
        >
          {hoy?.atipico ? (
            <AccesoBadge tono="advertencia" icono="trending_up">
              {t('flujo.atipico')}
            </AccesoBadge>
          ) : null}
        </TarjetaIndicador>
        <TarjetaIndicador
          etiqueta={t('flujo.detalle.diasAtipicos')}
          valor={formatearNumero(diasAtipicos, idioma)}
        />
        <TarjetaIndicador
          etiqueta={t('flujo.detalle.base')}
          valor={baseHoy === null ? t('flujo.detalle.sinBase') : formatearDecimal(baseHoy, idioma)}
        />
      </section>
      <TarjetaGrafica
        ancha
        titulo={t('flujo.detalle.graficaTitulo')}
        subtitulo={t('flujo.detalle.graficaSubtitulo')}
        tabla={{
          encabezados: [
            t('flujo.detalle.dia'),
            t('flujo.detalle.aperturas'),
            t('flujo.detalle.rechazos'),
            t('flujo.detalle.generados'),
            t('flujo.detalle.porUsuario'),
            t('flujo.detalle.marca'),
            t('flujo.detalle.baseDia'),
          ],
          filas: serie.map((dia) => [
            formatearDiaCalendario(dia.dia, idioma),
            dia.aperturas,
            dia.rechazos,
            dia.generados,
            formatearDecimal(dia.porUsuario, idioma),
            dia.atipico ? t('flujo.atipico') : t('flujo.normal'),
            dia.base === null ? t('flujo.sinBase') : formatearDecimal(dia.base, idioma),
          ]),
        }}
      >
        <GraficoDeFlujo
          serie={serie}
          etiqueta={t('flujo.detalle.graficaEtiqueta', {
            cuenta: cuenta.nombre,
            atipicos: formatearNumero(diasAtipicos, idioma),
          })}
        />
      </TarjetaGrafica>
      <p className={styles.umbrales}>
        {t('flujo.umbrales', {
          aperturas: formatearNumero(detalle.umbrales.aperturasMinimo, idioma),
          porUsuario: formatearNumero(detalle.umbrales.aperturasPorUsuario, idioma),
        })}
      </p>
      <p className={styles.umbrales}>
        <TextoMono>{detalle.zonaHoraria}</TextoMono>
      </p>
    </>
  );
}
