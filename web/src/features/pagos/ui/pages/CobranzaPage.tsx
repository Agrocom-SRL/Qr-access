import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatearFecha, formatearMonto } from '../../../../l10n/formatos';
import { codigoDe } from '../../../../shared/api/errorApi';
import { descargarExcel } from '../../../../shared/lib/excel';
import { rutaDePago } from '../../../../shared/lib/rutas';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { BadgeSuscripcion } from '../../../../shared/ui/atoms/BadgeSuscripcion';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { Buscador } from '../../../../shared/ui/molecules/Buscador';
import { EncabezadoPagina } from '../../../../shared/ui/molecules/EncabezadoPagina';
import { FiltroSegmentado } from '../../../../shared/ui/molecules/FiltroSegmentado';
import { ListadoPaginado } from '../../../../shared/ui/organisms/ListadoPaginado';
import type { Columna } from '../../../../shared/ui/organisms/TablaDatos';
import { TarjetaIndicador } from '../../../../shared/ui/organisms/TarjetaIndicador';
import { CobradoPorMes, useEstadisticas } from '../../../estadisticas';
import { useCobranza } from '../../application/usePagos';
import { PorCobrar } from '../components/PorCobrar';
import {
  cobranzaAExcel,
  VENTANAS,
  type FilaDeCobranza,
  type VentanaDeCobranza,
} from '../../domain/pago';
import styles from './CobranzaPage.module.css';

/** La ventana y la búsqueda viven en la URL para poder compartir el enlace. */
function ventanaDeLaUrl(valor: string | null): VentanaDeCobranza {
  return VENTANAS.find((v) => v === valor) ?? 'd30';
}

/** A08: lo que hay por cobrar por ventana de vencimiento, con acceso directo a registrar el pago y exportar a Excel. */
export function CobranzaPage() {
  const { t } = useTranslation(['cobranza', 'comun', 'cuentas']);
  const navegar = useNavigate();
  const [parametros, setParametros] = useSearchParams();
  const ventana = ventanaDeLaUrl(parametros.get('ventana'));
  const busqueda = parametros.get('q') ?? '';
  const cobranza = useCobranza(ventana, busqueda);
  const estadisticas = useEstadisticas();

  const cambiar = (siguiente: { ventana?: VentanaDeCobranza; busqueda?: string }) => {
    const nuevos = new URLSearchParams();
    const v = siguiente.ventana ?? ventana;
    const q = siguiente.busqueda ?? busqueda;
    if (v !== 'd30') nuevos.set('ventana', v);
    if (q !== '') nuevos.set('q', q);
    setParametros(nuevos, { replace: true });
  };

  const vence = (fila: FilaDeCobranza) => {
    if (fila.diasRestantes === 0) return t('cobranza:hoy');
    return fila.diasRestantes > 0
      ? t('cobranza:enDias', { count: fila.diasRestantes })
      : t('cobranza:haceDias', { count: Math.abs(fila.diasRestantes) });
  };

  const columnas: Columna<FilaDeCobranza>[] = [
    {
      id: 'cuenta',
      encabezado: t('cobranza:columna.cuenta'),
      celda: (f) => (
        <div>
          <strong>{f.cuenta.nombre}</strong>
          <p className={styles.codigo}>
            <TextoMono>{f.cuenta.codigo}</TextoMono>
          </p>
        </div>
      ),
    },
    {
      id: 'plan',
      encabezado: t('cobranza:columna.plan'),
      secundaria: true,
      celda: (f) => (
        <span className={styles.suave}>
          {t('cuentas:usuariosDe', { count: f.plan.cupoUsuarios ?? 0 })}
        </span>
      ),
    },
    {
      id: 'monto',
      encabezado: t('cobranza:columna.monto'),
      alinear: 'fin',
      celda: (f) => <TextoMono>{formatearMonto(f.monto)}</TextoMono>,
    },
    {
      id: 'vence',
      encabezado: t('cobranza:columna.vence'),
      celda: (f) =>
        f.estado === 'pendientePago' ? (
          <span className={styles.suave}>{t('cobranza:sinVigencia')}</span>
        ) : (
          <div>
            <TextoMono>{formatearFecha(f.venceEl)}</TextoMono>
            <p className={styles.dias}>{vence(f)}</p>
          </div>
        ),
    },
    {
      id: 'pago',
      encabezado: t('cobranza:columna.pago'),
      secundaria: true,
      celda: (f) => (
        <span className={f.pago === 'sinPagar' ? styles.sinPagar : styles.pendiente}>
          {t(`cobranza:estadoPago.${f.pago}`)}
        </span>
      ),
    },
    {
      id: 'estado',
      encabezado: t('cobranza:columna.estado'),
      celda: (f) => <BadgeSuscripcion estado={f.estado} />,
    },
    {
      id: 'accion',
      encabezado: t('cobranza:columna.accion'),
      alinear: 'fin',
      celda: (f) => (
        <AccesoBoton
          variante="tonal"
          icono="receipt_long"
          aria-label={t('cobranza:registrarPagoDe', { cuenta: f.cuenta.nombre })}
          onClick={() => {
            void navegar(rutaDePago(f.cuenta.id));
          }}
        >
          {f.pago === 'porActivar'
            ? t('cobranza:registrarPrimerPago')
            : t('cobranza:registrarPago')}
        </AccesoBoton>
      ),
    },
  ];

  const exportar = () => {
    if (!cobranza.data) return;
    const libro = cobranzaAExcel(
      cobranza.data.filas,
      [
        t('cobranza:excel.cuenta'),
        t('cobranza:excel.codigo'),
        t('cobranza:excel.plan'),
        t('cobranza:excel.monto'),
        t('cobranza:excel.vence'),
        t('cobranza:excel.pago'),
      ],
      t('cobranza:excel.hoja'),
      (pago) => t(`cobranza:estadoPago.${pago}`),
    );
    void descargarExcel(`${t('cobranza:excel.archivo')}-${ventana}.xlsx`, libro);
  };

  const totales = cobranza.data?.totales;
  const conteos = cobranza.data?.conteos;
  return (
    <>
      <EncabezadoPagina
        titulo={t('cobranza:titulo')}
        subtitulo={t('cobranza:subtitulo')}
        accion={
          <AccesoBoton
            variante="tonal"
            icono="download"
            disabled={!cobranza.data || cobranza.data.filas.length === 0}
            onClick={exportar}
          >
            {t('cobranza:exportar')}
          </AccesoBoton>
        }
      />

      <div className={styles.totales} aria-busy={cobranza.isPending || undefined}>
        <TarjetaIndicador
          tono="hero"
          etiqueta={t('cobranza:porCobrar30')}
          valor={totales ? formatearMonto(totales.porCobrar30.monto) : '—'}
          detalle={
            totales ? t('cobranza:cuentas', { count: totales.porCobrar30.cuentas }) : undefined
          }
        />
        <TarjetaIndicador
          etiqueta={t('cobranza:porCobrar90')}
          valor={totales ? formatearMonto(totales.porCobrar90.monto) : '—'}
          detalle={
            totales ? t('cobranza:cuentas', { count: totales.porCobrar90.cuentas }) : undefined
          }
        />
        <TarjetaIndicador
          tono="advertencia"
          etiqueta={t('cobranza:porActivar')}
          valor={totales ? formatearMonto(totales.porActivar.monto) : '—'}
          detalle={
            totales ? t('cobranza:cuentasNuevas', { count: totales.porActivar.cuentas }) : undefined
          }
        />
        <TarjetaIndicador
          tono="peligro"
          etiqueta={t('cobranza:vencidoSinPagar')}
          valor={totales ? formatearMonto(totales.vencidoSinPagar.monto) : '—'}
          detalle={
            totales
              ? t('cobranza:vencidasRechazadas', { count: totales.vencidoSinPagar.cuentas })
              : undefined
          }
        />
        <TarjetaIndicador
          etiqueta={t('cobranza:cobradoAnio', { anio: totales?.cobradoAnio.anio ?? '' })}
          valor={totales ? formatearMonto(totales.cobradoAnio.monto) : '—'}
          detalle={
            totales
              ? t('cobranza:pagosRegistrados', { count: totales.cobradoAnio.pagos })
              : undefined
          }
        />
      </div>

      <div className={styles.graficas}>
        {estadisticas.data ? <CobradoPorMes estadisticas={estadisticas.data} /> : null}
        {totales ? <PorCobrar totales={totales} /> : null}
      </div>

      <div className={styles.barra}>
        <Buscador
          etiqueta={t('cobranza:buscar')}
          placeholder={t('cobranza:buscar')}
          value={busqueda}
          onChange={(e) => {
            cambiar({ busqueda: e.target.value });
          }}
        />
        <FiltroSegmentado<VentanaDeCobranza>
          etiqueta={t('cobranza:filtroEtiqueta')}
          valor={ventana}
          onCambio={(siguiente) => {
            cambiar({ ventana: siguiente });
          }}
          opciones={VENTANAS.map((v) => ({
            valor: v,
            etiqueta: t(`cobranza:filtro.${v}`),
            conteo: conteos?.[v],
          }))}
        />
      </div>

      <ListadoPaginado
        etiqueta={t('cobranza:tabla')}
        columnas={columnas}
        filas={cobranza.data?.filas}
        claveDe={(f) => f.cuenta.id}
        cargando={cobranza.isPending}
        hayError={cobranza.isError}
        errorCode={codigoDe(cobranza.error)}
        onReintentar={() => void cobranza.refetch()}
        tituloError={t('cobranza:errorCarga')}
        vacio={
          ventana === 'vencidas'
            ? {
                titulo: t('cobranza:vacioVencidas.titulo'),
                texto: t('cobranza:vacioVencidas.texto'),
              }
            : ventana === 'pendientes'
              ? {
                  titulo: t('cobranza:vacioPendientes.titulo'),
                  texto: t('cobranza:vacioPendientes.texto'),
                }
              : { titulo: t('cobranza:vacio.titulo'), texto: t('cobranza:vacio.texto') }
        }
      />
    </>
  );
}
