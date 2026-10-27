import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { formatearNumero } from '../../../../l10n/formatos';
import { rutaDeCuenta } from '../../../../shared/lib/rutas';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { Spinner } from '../../../../shared/ui/atoms/Spinner';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { FiltroSegmentado } from '../../../../shared/ui/molecules/FiltroSegmentado';
import { TablaDatos, type Columna } from '../../../../shared/ui/organisms/TablaDatos';
import { useResumenDeSenales } from '../../application/useSenales';
import {
  PERIODOS_DEL_RESUMEN,
  type ResumenPorCuenta,
  type ResumenPorTipo,
} from '../../domain/senal';
import styles from './ResumenDeSenales.module.css';

/**
 * Cuántas señales hubo en el periodo, por tipo, y las diez cuentas con más. Es lectura para la
 * persona que revisa: el conteo no decide sobre ninguna cuenta.
 */
export function ResumenDeSenales() {
  const { t, i18n } = useTranslation(['senales', 'comun']);
  const idioma = i18n.language;
  const [dias, setDias] = useState<number>(PERIODOS_DEL_RESUMEN[0]);
  const consulta = useResumenDeSenales(dias);
  const datos = consulta.data;

  const columnasPorTipo: readonly Columna<ResumenPorTipo>[] = [
    {
      id: 'tipo',
      encabezado: t('senales:lista.resumen.tipo'),
      celda: (fila) => t(`senales:lista.tipo.${fila.tipo}`),
    },
    {
      id: 'total',
      encabezado: t('senales:lista.resumen.total'),
      alinear: 'fin',
      celda: (fila) => <TextoMono>{formatearNumero(fila.total, idioma)}</TextoMono>,
    },
    {
      id: 'abiertas',
      encabezado: t('senales:lista.resumen.abiertas'),
      alinear: 'fin',
      celda: (fila) => <TextoMono>{formatearNumero(fila.abiertas, idioma)}</TextoMono>,
    },
    {
      id: 'altas',
      encabezado: t('senales:lista.resumen.altas'),
      alinear: 'fin',
      celda: (fila) => <TextoMono>{formatearNumero(fila.altas, idioma)}</TextoMono>,
    },
  ];

  const columnasPorCuenta: readonly Columna<ResumenPorCuenta>[] = [
    {
      id: 'cuenta',
      encabezado: t('senales:lista.resumen.cuenta'),
      celda: (fila) => (
        <Link to={rutaDeCuenta(fila.cuenta.id)} className={styles.enlace}>
          <TextoMono>{fila.cuenta.codigo}</TextoMono> {fila.cuenta.nombre}
        </Link>
      ),
    },
    {
      id: 'total',
      encabezado: t('senales:lista.resumen.total'),
      alinear: 'fin',
      celda: (fila) => <TextoMono>{formatearNumero(fila.total, idioma)}</TextoMono>,
    },
    {
      id: 'abiertas',
      encabezado: t('senales:lista.resumen.abiertas'),
      alinear: 'fin',
      celda: (fila) => <TextoMono>{formatearNumero(fila.abiertas, idioma)}</TextoMono>,
    },
    {
      id: 'altas',
      encabezado: t('senales:lista.resumen.altas'),
      alinear: 'fin',
      celda: (fila) => <TextoMono>{formatearNumero(fila.altas, idioma)}</TextoMono>,
    },
  ];

  return (
    <section className={styles.resumen} aria-labelledby="resumen-de-senales">
      <header className={styles.cabecera}>
        <h2 id="resumen-de-senales" className={styles.titulo}>
          {t('senales:lista.resumen.titulo')}
        </h2>
        <FiltroSegmentado
          etiqueta={t('senales:periodo')}
          valor={String(dias)}
          onCambio={(valor) => {
            setDias(Number(valor));
          }}
          opciones={PERIODOS_DEL_RESUMEN.map((periodo) => ({
            valor: String(periodo),
            etiqueta: t('senales:dias', { count: periodo }),
          }))}
        />
      </header>
      {consulta.isError ? (
        <Aviso tono="peligro">
          {t('senales:lista.resumen.errorCarga')}
          <AccesoBoton
            variante="tonal"
            icono="refresh"
            onClick={() => {
              void consulta.refetch();
            }}
          >
            {t('comun:reintentar')}
          </AccesoBoton>
        </Aviso>
      ) : null}
      {datos === undefined ? (
        consulta.isError ? null : (
          <Spinner />
        )
      ) : datos.total === 0 ? (
        <p className={styles.vacio}>{t('senales:lista.resumen.sinSenales')}</p>
      ) : (
        <>
          <p className={styles.subtitulo}>
            {t('senales:lista.resumen.subtitulo', {
              dias: t('senales:dias', { count: datos.dias }),
              total: formatearNumero(datos.total, idioma),
              abiertas: formatearNumero(datos.abiertas, idioma),
            })}
          </p>
          <div className={styles.tablas}>
            <TablaDatos
              etiqueta={t('senales:lista.resumen.titulo')}
              columnas={columnasPorTipo}
              filas={datos.porTipo}
              claveDe={(fila) => fila.tipo}
            />
            <TablaDatos
              etiqueta={t('senales:lista.resumen.cuentas')}
              columnas={columnasPorCuenta}
              filas={datos.cuentas}
              claveDe={(fila) => fila.cuenta.id}
            />
          </div>
        </>
      )}
    </section>
  );
}
