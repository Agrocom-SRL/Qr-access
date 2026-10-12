import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TarjetaGrafica } from '../../../shared/ui/organisms/TarjetaGrafica';
import type { Estadisticas } from '../domain/estadisticas';
import { ALTO_DE_GRAFICA, ESTILO_DE_EJE, sinAnimacion } from './ejes';
import { etiquetaDeMes } from './formatoDeSeries';
import { TooltipGrafica } from './TooltipGrafica';

/** Cuentas nuevas por mes en el último año. */
export function AltasPorMes({
  estadisticas,
  ancha = false,
}: {
  estadisticas: Estadisticas;
  ancha?: boolean;
}) {
  const { t, i18n } = useTranslation('estadisticas');
  const idioma = i18n.language;
  const datos = estadisticas.altasPorMes.map((fila) => ({
    ...fila,
    etiqueta: etiquetaDeMes(fila.mes, idioma),
  }));
  const total = datos.reduce((suma, fila) => suma + fila.cuentas, 0);
  return (
    <TarjetaGrafica
      ancha={ancha}
      titulo={t('altasTitulo')}
      subtitulo={t('altasSubtitulo', { count: total })}
      tabla={{
        encabezados: [t('mes'), t('cuentasNuevas')],
        filas: estadisticas.altasPorMes.map((fila) => [
          etiquetaDeMes(fila.mes, idioma, true),
          fila.cuentas,
        ]),
      }}
    >
      <div role="img" aria-label={t('altasTitulo')}>
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
                    titulo={etiquetaDeMes(fila.mes, idioma, true)}
                    lineas={[
                      { nombre: t('cuentasNuevas'), color: 'var(--primario)', valor: fila.cuentas },
                    ]}
                  />
                );
              }}
            />
            <Bar
              dataKey="cuentas"
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
