import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatearNumero } from '../../../l10n/formatos';
import { codigoDe } from '../../../shared/api/errorApi';
import { ALTO_DE_GRAFICA, ESTILO_DE_EJE, sinAnimacion } from '../../../shared/lib/graficas';
import { Skeleton } from '../../../shared/ui/atoms/Skeleton';
import { TextoMono } from '../../../shared/ui/atoms/TextoMono';
import { EstadoError } from '../../../shared/ui/organisms/EstadoError';
import { TarjetaGrafica } from '../../../shared/ui/organisms/TarjetaGrafica';
import { TooltipGrafica } from '../../../shared/ui/organisms/TooltipGrafica';
import { useAperturaManual } from '../application/useEstadisticas';
import { porcentajeManual, type AperturaManual } from '../domain/aperturaManual';
import styles from './AperturaManualDelPanel.module.css';
import { etiquetaDeDia } from './formatoDeSeries';

/**
 * El uso de la apertura manual desde la app (ADR 0035, HU-21): cuántas veces se usó, con qué frecuencia, en qué
 * puertas y cuentas, qué cuentas la tienen activa y cuántas órdenes no abrieron. Es el camino más rápido para
 * entrar o salir de quien ya tiene la app, así que también dice qué parte de las aperturas representa.
 */
export function AperturaManualDelPanel() {
  const { t } = useTranslation('estadisticas');
  const consulta = useAperturaManual();
  if (consulta.isError) {
    return (
      <EstadoError
        titulo={t('errorCarga')}
        code={codigoDe(consulta.error)}
        onReintentar={() => void consulta.refetch()}
      />
    );
  }
  if (consulta.isPending) return <Skeleton alto="bloque" />;
  return <Contenido datos={consulta.data} />;
}

function Contenido({ datos }: { datos: AperturaManual }) {
  const { t, i18n } = useTranslation('estadisticas');
  const idioma = i18n.language;
  const numero = (valor: number) => formatearNumero(valor, idioma);
  const { configuracion } = datos;
  const dias = datos.porDia.map((fila) => ({ ...fila, etiqueta: etiquetaDeDia(fila.dia, idioma) }));
  const horas = datos.porHora.map((fila) => ({
    ...fila,
    etiqueta: String(fila.hora).padStart(2, '0'),
  }));
  const cifras: { clave: string; etiqueta: string; valor: string }[] = [
    { clave: 'ordenadas', etiqueta: t('aperturaOrdenadas'), valor: numero(datos.ordenadas) },
    { clave: 'rechazadas', etiqueta: t('aperturaRechazadas'), valor: numero(datos.rechazadas) },
    {
      clave: 'fallidas',
      etiqueta: t('aperturaNoAbrieron'),
      valor: numero(datos.ejecucion.fallidas + datos.ejecucion.sinConfirmacion),
    },
    {
      clave: 'peso',
      etiqueta: t('aperturaPeso'),
      valor: t('aperturaPorcentaje', { porcentaje: numero(porcentajeManual(datos)) }),
    },
    {
      clave: 'cuentasActivas',
      etiqueta: t('aperturaCuentasActivas'),
      valor: t('aperturaDe', {
        parte: numero(configuracion.cuentasConModoActivo),
        total: numero(configuracion.cuentas),
      }),
    },
    {
      clave: 'puertasDisponibles',
      etiqueta: t('aperturaPuertasDisponibles'),
      valor: t('aperturaDe', {
        parte: numero(configuracion.disponibles),
        total: numero(configuracion.puertas),
      }),
    },
    {
      clave: 'cuentasUsaron',
      etiqueta: t('aperturaCuentasUsaron'),
      valor: numero(datos.cuentasQueLaUsaron),
    },
    { clave: 'usuarios', etiqueta: t('aperturaUsuarios'), valor: numero(datos.usuarios) },
  ];
  return (
    <section className={styles.seccion} aria-labelledby="apertura-manual">
      <header>
        <h2 id="apertura-manual" className={styles.titulo}>
          {t('aperturaTitulo')}
        </h2>
        <p className={styles.subtitulo}>{t('aperturaSubtitulo', { dias: datos.dias })}</p>
      </header>
      <dl className={styles.cifras}>
        {cifras.map((cifra) => (
          <div key={cifra.clave} className={styles.cifra}>
            <dt>{cifra.etiqueta}</dt>
            <dd>
              <TextoMono>{cifra.valor}</TextoMono>
            </dd>
          </div>
        ))}
      </dl>
      <div className={styles.rejilla}>
        <TarjetaGrafica
          titulo={t('aperturaPorDiaTitulo')}
          subtitulo={t('aperturaPorDiaSubtitulo', {
            ordenadas: numero(datos.ordenadas),
            rechazadas: numero(datos.rechazadas),
          })}
          tabla={{
            encabezados: [t('dia'), t('aperturaOrdenadas'), t('aperturaRechazadas')],
            filas: dias.map((fila) => [fila.etiqueta, fila.ordenadas, fila.rechazadas]),
          }}
        >
          <div role="img" aria-label={t('aperturaPorDiaTitulo')}>
            <ResponsiveContainer width="100%" height={ALTO_DE_GRAFICA}>
              <BarChart data={dias} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--borde)" />
                <XAxis dataKey="etiqueta" {...ESTILO_DE_EJE} interval="preserveStartEnd" />
                <YAxis {...ESTILO_DE_EJE} axisLine={false} width={36} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'var(--primarioSuave)' }}
                  content={({ active, payload }) => {
                    const fila = payload[0]?.payload as (typeof dias)[number] | undefined;
                    if (!active || !fila) return null;
                    return (
                      <TooltipGrafica
                        titulo={fila.etiqueta}
                        lineas={[
                          {
                            nombre: t('aperturaOrdenadas'),
                            color: 'var(--primario)',
                            valor: numero(fila.ordenadas),
                          },
                          {
                            nombre: t('aperturaRechazadas'),
                            color: 'var(--peligro)',
                            valor: numero(fila.rechazadas),
                          },
                        ]}
                      />
                    );
                  }}
                />
                <Bar
                  dataKey="ordenadas"
                  stackId="aperturas"
                  fill="var(--primario)"
                  stroke="var(--superficie)"
                  strokeWidth={2}
                  maxBarSize={20}
                  isAnimationActive={!sinAnimacion()}
                />
                <Bar
                  dataKey="rechazadas"
                  stackId="aperturas"
                  fill="var(--peligro)"
                  stroke="var(--superficie)"
                  strokeWidth={2}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={20}
                  isAnimationActive={!sinAnimacion()}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TarjetaGrafica>
        <TarjetaGrafica
          titulo={t('aperturaPorHoraTitulo')}
          subtitulo={t('aperturaPorHoraSubtitulo')}
          tabla={{
            encabezados: [t('aperturaHora'), t('aperturaOrdenadas')],
            filas: horas.map((fila) => [fila.etiqueta, fila.total]),
          }}
        >
          <div role="img" aria-label={t('aperturaPorHoraTitulo')}>
            <ResponsiveContainer width="100%" height={ALTO_DE_GRAFICA}>
              <BarChart data={horas} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--borde)" />
                <XAxis dataKey="etiqueta" {...ESTILO_DE_EJE} interval={2} />
                <YAxis {...ESTILO_DE_EJE} axisLine={false} width={36} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'var(--primarioSuave)' }}
                  content={({ active, payload }) => {
                    const fila = payload[0]?.payload as (typeof horas)[number] | undefined;
                    if (!active || !fila) return null;
                    return (
                      <TooltipGrafica
                        titulo={`${fila.etiqueta}:00`}
                        lineas={[
                          {
                            nombre: t('aperturaOrdenadas'),
                            color: 'var(--primario)',
                            valor: numero(fila.total),
                          },
                        ]}
                      />
                    );
                  }}
                />
                <Bar
                  dataKey="total"
                  fill="var(--primario)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={20}
                  isAnimationActive={!sinAnimacion()}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TarjetaGrafica>
      </div>
      <div className={styles.rejilla}>
        <TablaDePuertas datos={datos} />
        <TablaDeCuentas datos={datos} />
      </div>
    </section>
  );
}

function TablaDePuertas({ datos }: { datos: AperturaManual }) {
  const { t, i18n } = useTranslation('estadisticas');
  const numero = (valor: number) => formatearNumero(valor, i18n.language);
  return (
    <section className={styles.tarjeta} aria-labelledby="apertura-puertas">
      <h3 id="apertura-puertas" className={styles.titulo}>
        {t('aperturaPuertasTitulo')}
      </h3>
      {datos.porPuerta.length === 0 ? (
        <p className={styles.vacio}>{t('aperturaSinUso')}</p>
      ) : (
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th scope="col">{t('aperturaPuerta')}</th>
              <th scope="col">{t('aperturaCuenta')}</th>
              <th scope="col" className={styles.numero}>
                {t('aperturaOrdenadas')}
              </th>
              <th scope="col" className={styles.numero}>
                {t('aperturaRechazadas')}
              </th>
            </tr>
          </thead>
          <tbody>
            {datos.porPuerta.map((fila) => (
              <tr key={fila.puerta.id}>
                <th scope="row">
                  {fila.puerta.nombre} · {fila.puerta.sitio}
                </th>
                <td>{fila.cuenta.nombre}</td>
                <td className={styles.numero}>
                  <TextoMono>{numero(fila.total - fila.rechazadas)}</TextoMono>
                </td>
                <td className={styles.numero}>
                  <TextoMono>{numero(fila.rechazadas)}</TextoMono>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function TablaDeCuentas({ datos }: { datos: AperturaManual }) {
  const { t, i18n } = useTranslation('estadisticas');
  const numero = (valor: number) => formatearNumero(valor, i18n.language);
  return (
    <section className={styles.tarjeta} aria-labelledby="apertura-cuentas">
      <h3 id="apertura-cuentas" className={styles.titulo}>
        {t('aperturaCuentasTitulo')}
      </h3>
      {datos.porCuenta.length === 0 ? (
        <p className={styles.vacio}>{t('aperturaSinUso')}</p>
      ) : (
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th scope="col">{t('aperturaCuenta')}</th>
              <th scope="col" className={styles.numero}>
                {t('aperturaUsuarios')}
              </th>
              <th scope="col" className={styles.numero}>
                {t('aperturaOrdenadas')}
              </th>
              <th scope="col" className={styles.numero}>
                {t('aperturaRechazadas')}
              </th>
            </tr>
          </thead>
          <tbody>
            {datos.porCuenta.map((fila) => (
              <tr key={fila.cuenta.id}>
                <th scope="row">{fila.cuenta.nombre}</th>
                <td className={styles.numero}>
                  <TextoMono>{numero(fila.usuarios)}</TextoMono>
                </td>
                <td className={styles.numero}>
                  <TextoMono>{numero(fila.total - fila.rechazadas)}</TextoMono>
                </td>
                <td className={styles.numero}>
                  <TextoMono>{numero(fila.rechazadas)}</TextoMono>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
