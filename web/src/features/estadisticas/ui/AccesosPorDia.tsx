import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatearNumero } from '../../../l10n/formatos';
import { TarjetaGrafica } from '../../../shared/ui/organisms/TarjetaGrafica';
import type { Estadisticas } from '../domain/estadisticas';
import { ALTO_DE_GRAFICA, ESTILO_DE_EJE, sinAnimacion } from './ejes';
import { etiquetaDeDia } from './formatoDeSeries';
import { TooltipGrafica } from './TooltipGrafica';
import styles from './Graficas.module.css';

/**
 * Los intentos de acceso de los últimos 14 días en todas las cuentas: permitidos y rechazados
 * apilados. Con dos series que se parecen para quien no distingue rojo de verde, hay leyenda,
 * un espacio de 2 px entre los tramos y la misma información en tabla.
 */
export function AccesosPorDia({
  estadisticas,
  ancha = false,
}: {
  estadisticas: Estadisticas;
  ancha?: boolean;
}) {
  const { t, i18n } = useTranslation('estadisticas');
  const idioma = i18n.language;
  const datos = estadisticas.accesosPorDia.map((fila) => ({
    ...fila,
    etiqueta: etiquetaDeDia(fila.dia, idioma),
  }));
  const permitidos = datos.reduce((suma, fila) => suma + fila.permitidos, 0);
  const rechazados = datos.reduce((suma, fila) => suma + fila.rechazados, 0);
  return (
    <TarjetaGrafica
      ancha={ancha}
      titulo={t('accesosTitulo')}
      subtitulo={t('accesosSubtitulo', {
        permitidos: formatearNumero(permitidos, idioma),
        rechazados: formatearNumero(rechazados, idioma),
      })}
      tabla={{
        encabezados: [t('dia'), t('permitidos'), t('rechazados')],
        filas: datos.map((fila) => [fila.etiqueta, fila.permitidos, fila.rechazados]),
      }}
    >
      <ul className={styles.leyenda} aria-label={t('leyenda')}>
        <li>
          <span className={styles.muestra} style={{ background: 'var(--primario)' }} />
          {t('permitidos')}
        </li>
        <li>
          <span className={styles.muestra} style={{ background: 'var(--peligro)' }} />
          {t('rechazados')}
        </li>
      </ul>
      <div role="img" aria-label={t('accesosTitulo')}>
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
                        nombre: t('permitidos'),
                        color: 'var(--primario)',
                        valor: formatearNumero(fila.permitidos, idioma),
                      },
                      {
                        nombre: t('rechazados'),
                        color: 'var(--peligro)',
                        valor: formatearNumero(fila.rechazados, idioma),
                      },
                    ]}
                  />
                );
              }}
            />
            <Bar
              dataKey="permitidos"
              stackId="accesos"
              fill="var(--primario)"
              stroke="var(--superficie)"
              strokeWidth={2}
              maxBarSize={28}
              isAnimationActive={!sinAnimacion()}
            />
            <Bar
              dataKey="rechazados"
              stackId="accesos"
              fill="var(--peligro)"
              stroke="var(--superficie)"
              strokeWidth={2}
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
              isAnimationActive={!sinAnimacion()}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </TarjetaGrafica>
  );
}
