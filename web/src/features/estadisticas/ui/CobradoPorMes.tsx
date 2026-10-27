import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatearMonto } from '../../../l10n/formatos';
import { TarjetaGrafica } from '../../../shared/ui/organisms/TarjetaGrafica';
import type { Estadisticas } from '../domain/estadisticas';
import { ALTO_DE_GRAFICA, ESTILO_DE_EJE, sinAnimacion } from '../../../shared/lib/graficas';
import { etiquetaDeMes, montoCompacto } from './formatoDeSeries';
import { TooltipGrafica } from '../../../shared/ui/organisms/TooltipGrafica';

/** Lo cobrado cada mes en el último año: una columna por mes, un solo color (la magnitud es el dato). */
export function CobradoPorMes({
  estadisticas,
  ancha = false,
}: {
  estadisticas: Estadisticas;
  ancha?: boolean;
}) {
  const { t, i18n } = useTranslation('estadisticas');
  const idioma = i18n.language;
  const datos = estadisticas.cobradoPorMes.map((fila) => ({
    ...fila,
    etiqueta: etiquetaDeMes(fila.mes, idioma),
  }));
  const total = datos.reduce((suma, fila) => suma + fila.monto, 0);
  return (
    <TarjetaGrafica
      ancha={ancha}
      titulo={t('cobradoTitulo')}
      subtitulo={t('cobradoSubtitulo', { total: formatearMonto(total, idioma) })}
      tabla={{
        encabezados: [t('mes'), t('monto'), t('pagos')],
        filas: estadisticas.cobradoPorMes.map((fila) => [
          etiquetaDeMes(fila.mes, idioma, true),
          formatearMonto(fila.monto, idioma),
          fila.pagos,
        ]),
      }}
    >
      <div role="img" aria-label={t('cobradoTitulo')}>
        <ResponsiveContainer width="100%" height={ALTO_DE_GRAFICA}>
          <BarChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--borde)" />
            <XAxis dataKey="etiqueta" {...ESTILO_DE_EJE} interval="preserveStartEnd" />
            <YAxis
              {...ESTILO_DE_EJE}
              axisLine={false}
              width={48}
              tickFormatter={(valor: number) => montoCompacto(valor, idioma)}
            />
            <Tooltip
              cursor={{ fill: 'var(--primarioSuave)' }}
              content={({ active, payload }) => {
                const fila = payload[0]?.payload as (typeof datos)[number] | undefined;
                if (!active || !fila) return null;
                return (
                  <TooltipGrafica
                    titulo={etiquetaDeMes(fila.mes, idioma, true)}
                    lineas={[
                      {
                        nombre: t('monto'),
                        color: 'var(--primario)',
                        valor: formatearMonto(fila.monto, idioma),
                      },
                      { nombre: t('pagos'), color: 'var(--borde)', valor: fila.pagos },
                    ]}
                  />
                );
              }}
            />
            <Bar
              dataKey="monto"
              fill="var(--primario)"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
              isAnimationActive={!sinAnimacion()}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </TarjetaGrafica>
  );
}
