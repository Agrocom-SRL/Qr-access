import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { formatearFecha, formatearMonto } from '../../../../l10n/formatos';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { rutaDePago } from '../../../../shared/lib/rutas';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { Skeleton } from '../../../../shared/ui/atoms/Skeleton';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { ConfirmarDialogo } from '../../../../shared/ui/organisms/ConfirmarDialogo';
import { EstadoError } from '../../../../shared/ui/organisms/EstadoError';
import { EstadoVacio } from '../../../../shared/ui/organisms/EstadoVacio';
import { TablaDatos, type Columna } from '../../../../shared/ui/organisms/TablaDatos';
import type { PlanCambiado } from '../../api/SuscripcionesRepositorio';
import {
  useReactivar,
  useSuscripcionDeCuenta,
  useSuspender,
} from '../../application/useSuscripcion';
import { admiteCambios, type PagoDeCuenta } from '../../domain/suscripcion';
import { DialogoCambiarPlan } from './DialogoCambiarPlan';
import styles from './PestanaSuscripcion.module.css';

interface Props {
  cuenta: { id: string; nombre: string; codigo: string; usuariosActivos: number };
}

/** Pestaña "Suscripción" de la ficha (A05b): resumen, acciones e historial de renovaciones y pagos. */
export function PestanaSuscripcion({ cuenta }: Props) {
  const { t } = useTranslation(['suscripcion', 'cambiarPlan', 'comun']);
  const navegar = useNavigate();
  const consulta = useSuscripcionDeCuenta(cuenta.id);
  const suspender = useSuspender(cuenta.id);
  const reactivar = useReactivar(cuenta.id);
  const [cambiandoPlan, setCambiandoPlan] = useState(false);
  const [confirmando, setConfirmando] = useState<'suspender' | 'reactivar' | null>(null);
  const [mejora, setMejora] = useState<PlanCambiado | null>(null);

  if (consulta.isError) {
    return (
      <EstadoError
        titulo={t('suscripcion:errorCarga')}
        code={codigoDe(consulta.error)}
        onReintentar={() => void consulta.refetch()}
      />
    );
  }
  if (consulta.isPending) {
    return (
      <div aria-busy="true">
        <Skeleton alto="bloque" />
      </div>
    );
  }

  const { suscripcion, proximoPago, pagos } = consulta.data;
  const suspendida = suscripcion.estado === 'suspendida';
  const pendiente = suscripcion.estado === 'pendientePago';
  const medio = (valor: PagoDeCuenta['medio']) => t(`suscripcion:medios.${valor}`);
  const periodo = (desde: Date, hasta: Date) =>
    `${formatearFecha(desde)} – ${formatearFecha(hasta)}`;

  const columnas: Columna<PagoDeCuenta>[] = [
    {
      id: 'periodo',
      encabezado: t('suscripcion:columna.periodo'),
      celda: (p) => <TextoMono>{periodo(p.periodoDesde, p.periodoHasta)}</TextoMono>,
    },
    {
      id: 'plan',
      encabezado: t('suscripcion:columna.plan'),
      celda: (p) => (
        <span className={styles.suave}>
          {p.plan}
          {p.tipo === 'mejoraDePlan' ? ` · ${t('suscripcion:mejora')}` : ''}
          {p.tipo === 'alta' ? ` · ${t('suscripcion:primerPago')}` : ''}
        </span>
      ),
    },
    {
      id: 'monto',
      encabezado: t('suscripcion:columna.monto'),
      alinear: 'fin',
      celda: (p) => <TextoMono>{formatearMonto(p.monto)}</TextoMono>,
    },
    {
      id: 'pagado',
      encabezado: t('suscripcion:columna.pagado'),
      celda: (p) => <TextoMono>{formatearFecha(`${p.fechaPago}T12:00:00Z`)}</TextoMono>,
    },
    {
      id: 'medio',
      encabezado: t('suscripcion:columna.medio'),
      secundaria: true,
      celda: (p) => medio(p.medio),
    },
    {
      id: 'referencia',
      encabezado: t('suscripcion:columna.referencia'),
      secundaria: true,
      celda: (p) => (
        <span className={styles.suave}>
          <TextoMono>{p.referencia}</TextoMono>
        </span>
      ),
    },
    {
      id: 'registro',
      encabezado: t('suscripcion:columna.registro'),
      secundaria: true,
      celda: (p) => <span className={styles.suave}>{p.registro?.nombre ?? '—'}</span>,
    },
  ];

  const errorDeAccion = suspender.error ?? reactivar.error;

  return (
    <div className={styles.contenedor}>
      {mejora ? (
        <Aviso tono="advertencia">
          <div className={styles.mejora}>
            <span>
              {t('suscripcion:mejoraRegistrada', {
                plan: mejora.plan.nombre,
                monto: formatearMonto(mejora.diferenciaPrecio),
              })}
            </span>
            <AccesoBoton
              variante="tonal"
              icono="receipt_long"
              onClick={() => {
                void navegar(
                  rutaDePago(cuenta.id, { tipo: 'mejora', monto: mejora.diferenciaPrecio }),
                );
              }}
            >
              {t('suscripcion:registrarDiferencia')}
            </AccesoBoton>
          </div>
        </Aviso>
      ) : null}
      {suspendida ? <Aviso tono="advertencia">{t('suscripcion:suspendidaAviso')}</Aviso> : null}
      {pendiente ? <Aviso tono="advertencia">{t('suscripcion:pendienteAviso')}</Aviso> : null}

      <section className={styles.resumen} aria-label={t('suscripcion:plan')}>
        <div>
          <p className={styles.etiqueta}>{t('suscripcion:plan')}</p>
          <p className={styles.valorTexto}>
            {t('cambiarPlan:usuarios', { count: suscripcion.plan.cupoUsuarios ?? 0 })}
          </p>
        </div>
        <div>
          <p className={styles.etiqueta}>{t('suscripcion:precioAnual')}</p>
          <p className={styles.valor}>
            <TextoMono fuerte>{formatearMonto(suscripcion.plan.precioAnual)}</TextoMono>
          </p>
        </div>
        <div>
          <p className={styles.etiqueta}>{t('suscripcion:periodo')}</p>
          <p className={styles.valor}>
            <TextoMono fuerte>{periodo(suscripcion.desde, suscripcion.hasta)}</TextoMono>
          </p>
        </div>
        <div>
          <p className={styles.etiqueta}>{t('suscripcion:proximoPago')}</p>
          <p className={proximoPago === 'sinPagar' ? styles.peligro : styles.advertencia}>
            {proximoPago === null ? '—' : t(`suscripcion:pago.${proximoPago}`)}
          </p>
        </div>
      </section>

      <div className={styles.acciones}>
        <div className={styles.principales}>
          <AccesoBoton
            icono={pendiente ? 'payments' : 'autorenew'}
            disabled={suspendida}
            onClick={() => {
              void navegar(rutaDePago(cuenta.id));
            }}
          >
            {pendiente ? t('suscripcion:registrarPrimerPago') : t('suscripcion:renovarPago')}
          </AccesoBoton>
          <AccesoBoton
            variante="tonal"
            icono="swap_vert"
            disabled={!admiteCambios(suscripcion.estado)}
            onClick={() => {
              setCambiandoPlan(true);
            }}
          >
            {t('suscripcion:cambiarPlan')}
          </AccesoBoton>
        </div>
        {pendiente ? null : suspendida ? (
          <AccesoBoton
            variante="tonal"
            icono="autorenew"
            onClick={() => {
              setConfirmando('reactivar');
            }}
          >
            {t('suscripcion:reactivar')}
          </AccesoBoton>
        ) : (
          <AccesoBoton
            variante="peligro"
            icono="pause_circle"
            onClick={() => {
              setConfirmando('suspender');
            }}
          >
            {t('suscripcion:suspender')}
          </AccesoBoton>
        )}
      </div>
      {errorDeAccion ? (
        <Aviso tono="peligro">{traducirError(t, codigoDe(errorDeAccion))}</Aviso>
      ) : null}

      <section className={styles.historial} aria-labelledby="historial-pagos">
        <h2 id="historial-pagos" className={styles.titulo}>
          {t('suscripcion:historial')}
        </h2>
        {pagos.length === 0 ? (
          <EstadoVacio
            ilustracion="vacioEventos"
            titulo={t('suscripcion:historialVacio.titulo')}
            texto={t('suscripcion:historialVacio.texto')}
          />
        ) : (
          <TablaDatos
            incrustada
            etiqueta={t('suscripcion:tablaHistorial')}
            columnas={columnas}
            filas={pagos}
            claveDe={(p) => p.id}
          />
        )}
      </section>

      <DialogoCambiarPlan
        abierto={cambiandoPlan}
        cuenta={cuenta}
        planActual={suscripcion.plan}
        hasta={suscripcion.hasta}
        onCerrar={() => {
          setCambiandoPlan(false);
        }}
        onCambiado={(cambio) => {
          setCambiandoPlan(false);
          setMejora(cambio);
        }}
      />
      <ConfirmarDialogo
        abierto={confirmando !== null}
        titulo={t(
          confirmando === 'reactivar'
            ? 'suscripcion:reactivarTitulo'
            : 'suscripcion:suspenderTitulo',
          {
            cuenta: cuenta.nombre,
          },
        )}
        texto={t(
          confirmando === 'reactivar' ? 'suscripcion:reactivarTexto' : 'suscripcion:suspenderTexto',
        )}
        etiquetaConfirmar={t(
          confirmando === 'reactivar'
            ? suspender.isPending || reactivar.isPending
              ? 'suscripcion:reactivando'
              : 'suscripcion:reactivar'
            : suspender.isPending || reactivar.isPending
              ? 'suscripcion:suspendiendo'
              : 'suscripcion:suspender',
        )}
        peligro={confirmando === 'suspender'}
        cargando={suspender.isPending || reactivar.isPending}
        onCancelar={() => {
          setConfirmando(null);
        }}
        onConfirmar={() => {
          const accion = confirmando === 'reactivar' ? reactivar : suspender;
          accion.mutate(undefined, {
            onSettled: () => {
              setConfirmando(null);
            },
          });
        }}
      />
    </div>
  );
}
