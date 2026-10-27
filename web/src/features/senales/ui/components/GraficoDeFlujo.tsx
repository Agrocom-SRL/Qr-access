import { useTranslation } from 'react-i18next';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  formatearDecimal,
  formatearDiaCalendario,
  formatearNumero,
} from '../../../../l10n/formatos';
import { ALTO_DE_GRAFICA, ESTILO_DE_EJE, sinAnimacion } from '../../../../shared/lib/graficas';
import { TooltipGrafica } from '../../../../shared/ui/organisms/TooltipGrafica';
import type { DiaDeFlujo } from '../../domain/flujo';
import styles from './GraficoDeFlujo.module.css';

/**
 * Aperturas por día con la base habitual como línea. Los días atípicos van en otro color y, para
 * quien no distingue colores, la leyenda y el tooltip lo dicen con texto. La misma serie está en
 * la tabla de `TarjetaGrafica`.
 */
export function GraficoDeFlujo({
  serie,
  etiqueta,
}: {
  serie: readonly DiaDeFlujo[];
  etiqueta: string;
}) {
  const { t, i18n } = useTranslation('senales');
  const idioma = i18n.language;
  // Dos series apiladas en vez de colorear cada barra: la leyenda y el tooltip nombran cada una.
  const datos = serie.map((fila) => ({
    ...fila,
    etiqueta: formatearDiaCalendario(fila.dia, idioma),
    normal: fila.atipico ? null : fila.aperturas,
    atipica: fila.atipico ? fila.aperturas : null,
  }));
  return (
    <>
      <ul className={styles.leyenda} aria-label={t('flujo.leyenda')}>
        <li>
          <span className={styles.muestra} style={{ background: 'var(--primario)' }} />
          {t('flujo.detalle.aperturas')}
        </li>
        <li>
          <span className={styles.muestra} style={{ background: 'var(--peligro)' }} />
          {t('flujo.atipico')}
        </li>
        <li>
          <span className={styles.linea} style={{ background: 'var(--informacion)' }} />
          {t('flujo.detalle.base')}
        </li>
      </ul>
      <div role="img" aria-label={etiqueta}>
        <ResponsiveContainer width="100%" height={ALTO_DE_GRAFICA}>
          <ComposedChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--borde)" />
            <XAxis dataKey="etiqueta" {...ESTILO_DE_EJE} interval="preserveStartEnd" />
            <YAxis {...ESTILO_DE_EJE} axisLine={false} width={36} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: 'var(--primarioSuave)' }}
              content={({ active, payload }) => {
                const fila = payload[0]?.payload as (typeof datos)[number] | undefined;
                if (!active || !fila) return null;
                return (
                  <TooltipGrafica
                    titulo={fila.etiqueta}
                    lineas={[
                      {
                        nombre: t('flujo.detalle.aperturas'),
                        color: fila.atipico ? 'var(--peligro)' : 'var(--primario)',
                        valor: formatearNumero(fila.aperturas, idioma),
                      },
                      {
                        nombre: t('flujo.detalle.base'),
                        color: 'var(--informacion)',
                        valor:
                          fila.base === null
                            ? t('flujo.sinBase')
                            : formatearDecimal(fila.base, idioma),
                      },
                      {
                        nombre: t('flujo.detalle.marca'),
                        color: 'var(--textoSecundario)',
                        valor: fila.atipico ? t('flujo.atipico') : t('flujo.normal'),
                      },
                    ]}
                  />
                );
              }}
            />
            <Bar
              dataKey="normal"
              stackId="aperturas"
              fill="var(--primario)"
              maxBarSize={28}
              isAnimationActive={!sinAnimacion()}
            />
            <Bar
              dataKey="atipica"
              stackId="aperturas"
              fill="var(--peligro)"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
              isAnimationActive={!sinAnimacion()}
            />
            <Line
              type="monotone"
              dataKey="base"
              stroke="var(--informacion)"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              connectNulls
              isAnimationActive={!sinAnimacion()}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
