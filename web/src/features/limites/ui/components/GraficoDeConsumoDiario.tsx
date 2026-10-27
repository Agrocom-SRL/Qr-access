import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatearDiaCalendario, formatearNumero } from '../../../../l10n/formatos';
import { ALTO_DE_GRAFICA, ESTILO_DE_EJE, sinAnimacion } from '../../../../shared/lib/graficas';
import { TooltipGrafica } from '../../../../shared/ui/organisms/TooltipGrafica';
import type { SerieDeConsumo } from '../../domain/consumo';

/**
 * QR generados por día del mes en curso. La misma cifra va como tabla (`TarjetaGrafica`) y el
 * gráfico se describe con `aria-label`: nadie depende del color ni del cursor para leerla.
 */
export function GraficoDeConsumoDiario({
  serie,
  etiqueta,
}: {
  serie: readonly SerieDeConsumo[];
  etiqueta: string;
}) {
  const { t, i18n } = useTranslation('limites');
  const idioma = i18n.language;
  const datos = serie.map((fila) => ({
    ...fila,
    etiqueta: formatearDiaCalendario(fila.dia, idioma),
  }));
  return (
    <div role="img" aria-label={etiqueta}>
      <ResponsiveContainer width="100%" height={ALTO_DE_GRAFICA}>
        <BarChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                      nombre: t('detalle.generados'),
                      color: 'var(--primario)',
                      valor: formatearNumero(fila.generados, idioma),
                    },
                  ]}
                />
              );
            }}
          />
          <Bar
            dataKey="generados"
            fill="var(--primario)"
            stroke="var(--superficie)"
            strokeWidth={2}
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
            isAnimationActive={!sinAnimacion()}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
