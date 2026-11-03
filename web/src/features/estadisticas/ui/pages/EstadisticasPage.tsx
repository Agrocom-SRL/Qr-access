import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { EncabezadoPagina } from '../../../../shared/ui/molecules/EncabezadoPagina';
import { Pestanas } from '../../../../shared/ui/organisms/Pestanas';
import { AperturaManualDelPanel } from '../AperturaManualDelPanel';
import { GraficasDelResumen } from '../GraficasDelResumen';
import { UsoPorPlan } from '../UsoPorPlan';
import styles from './EstadisticasPage.module.css';

type Seccion = 'cobros' | 'cuentas' | 'accesos';
const SECCIONES: readonly Seccion[] = ['cobros', 'cuentas', 'accesos'];

/**
 * Las estadísticas de la plataforma, en pestañas por tema: `cobros` (lo cobrado y cómo se reparten los planes),
 * `cuentas` (su estado y las altas) y `accesos` (lecturas y apertura desde la app). La pestaña va en la URL
 * (`?pestana=`) para compartir el enlace; sin ella, la primera.
 */
export function EstadisticasPage() {
  const { t } = useTranslation('estadisticas');
  const [parametros, setParametros] = useSearchParams();
  const activa = SECCIONES.find((seccion) => seccion === parametros.get('pestana')) ?? 'cobros';
  return (
    <>
      <EncabezadoPagina titulo={t('titulo')} subtitulo={t('subtitulo')} />
      <Pestanas
        etiqueta={t('pestanasEtiqueta')}
        activa={activa}
        onCambio={(siguiente) => {
          setParametros(siguiente === 'cobros' ? {} : { pestana: siguiente }, { replace: true });
        }}
        pestanas={SECCIONES.map((seccion) => ({ id: seccion, etiqueta: t(`pestanas.${seccion}`) }))}
      />
      <p className={styles.descripcion}>{t(`descripcion.${activa}`)}</p>
      <div className={styles.contenido}>
        {activa === 'cobros' ? (
          <>
            <GraficasDelResumen grupo="cobros" />
            <UsoPorPlan />
          </>
        ) : null}
        {activa === 'cuentas' ? <GraficasDelResumen grupo="cuentas" /> : null}
        {activa === 'accesos' ? (
          <>
            <GraficasDelResumen grupo="accesos" />
            <AperturaManualDelPanel />
          </>
        ) : null}
      </div>
    </>
  );
}
