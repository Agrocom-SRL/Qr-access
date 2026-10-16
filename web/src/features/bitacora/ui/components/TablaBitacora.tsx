import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatearFecha, formatearHora, relacionDeDia } from '../../../../l10n/formatos';
import { codigoDe } from '../../../../shared/api/errorApi';
import type { Paginado } from '../../../../shared/api/tipos';
import { AccesoBadge, type TonoBadge } from '../../../../shared/ui/atoms/AccesoBadge';
import { BotonIcono } from '../../../../shared/ui/atoms/BotonIcono';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { ListadoPaginado } from '../../../../shared/ui/organisms/ListadoPaginado';
import type { Columna } from '../../../../shared/ui/organisms/TablaDatos';
import type { CanalBitacora, EventoBitacora } from '../../domain/evento';
import { describirEvento } from '../describirEvento';
import { DialogoDetalleEvento } from './DialogoDetalleEvento';
import styles from './TablaBitacora.module.css';

/** Cada origen con su color, para distinguir de un vistazo qué panel, app o lector hizo el cambio. */
const TONO_DE_ORIGEN: Readonly<Record<CanalBitacora, TonoBadge>> = {
  panel: 'informacion',
  app: 'acento',
  automatico: 'neutro',
  dispositivo: 'neutro',
};

interface Props {
  datos: Paginado<EventoBitacora> | undefined;
  cargando: boolean;
  error: unknown;
  hayError: boolean;
  onReintentar: () => void;
  onPagina: (pagina: number) => void;
  /** En la bitácora de una cuenta la columna "Cuenta" sobra. */
  conCuenta: boolean;
  /** Mensaje del estado vacío (con filtros o sin ellos). */
  vacio: { titulo: string; texto: string };
}

/** La tabla de la bitácora (A10 y A05d): cuándo, quién, cuenta, qué, antes, después y desde dónde. */
export function TablaBitacora({
  datos,
  cargando,
  error,
  hayError,
  onReintentar,
  onPagina,
  conCuenta,
  vacio,
}: Props) {
  const { t } = useTranslation(['bitacora']);
  const [detalle, setDetalle] = useState<EventoBitacora | null>(null);

  const cuando = (fecha: Date) => {
    const dia = relacionDeDia(fecha);
    const hora = formatearHora(fecha);
    if (dia === 'hoy') return `${t('comun:hoy')} ${hora}`;
    return `${formatearFecha(fecha)} ${hora}`;
  };

  const columnas: Columna<EventoBitacora>[] = [
    {
      id: 'cuando',
      encabezado: t('bitacora:columna.cuando'),
      celda: (e) => (
        <span className={styles.suave}>
          <TextoMono>{cuando(e.ocurridoEn)}</TextoMono>
        </span>
      ),
    },
    {
      id: 'quien',
      encabezado: t('bitacora:columna.quien'),
      celda: (e) => <strong>{e.usuario?.nombre ?? t('bitacora:sistema')}</strong>,
    },
    ...(conCuenta
      ? [
          {
            id: 'cuenta',
            encabezado: t('bitacora:columna.cuenta'),
            secundaria: true,
            celda: (e: EventoBitacora) =>
              e.cuenta ? <TextoMono fuerte>{e.cuenta.codigo}</TextoMono> : <span>—</span>,
          },
        ]
      : []),
    {
      id: 'que',
      encabezado: t('bitacora:columna.que'),
      ajustable: true,
      celda: (e) => describirEvento(e, t).que,
    },
    {
      id: 'cambio',
      encabezado: t('bitacora:columna.cambio'),
      celda: (e) => {
        const d = describirEvento(e, t);
        return (
          <span className={styles.cambio}>
            <span className={styles.recortado}>
              <span className={styles.rotulo}>{t('bitacora:columna.antes')}</span> {d.antes}
            </span>
            <span className={styles.recortado}>
              <span className={styles.rotulo}>{t('bitacora:columna.despues')}</span> {d.despues}
            </span>
          </span>
        );
      },
    },
    {
      id: 'origen',
      encabezado: t('bitacora:columna.origen'),
      celda: (e) => (
        <AccesoBadge tono={TONO_DE_ORIGEN[e.canal]}>{t(`bitacora:origen.${e.canal}`)}</AccesoBadge>
      ),
    },
    {
      id: 'detalle',
      encabezado: t('bitacora:columna.detalle'),
      alinear: 'fin',
      celda: (e) => (
        <BotonIcono
          icono="visibility"
          accion="ver"
          etiqueta={t('bitacora:detalle.abrir')}
          onClick={() => {
            setDetalle(e);
          }}
        />
      ),
    },
  ];

  return (
    <>
      <ListadoPaginado
        etiqueta={t('bitacora:tabla')}
        columnas={columnas}
        filas={datos?.elementos}
        claveDe={(e) => e.id}
        cargando={cargando}
        hayError={hayError}
        errorCode={codigoDe(error)}
        onReintentar={onReintentar}
        tituloError={t('bitacora:errorCarga')}
        vacio={{ ...vacio, ilustracion: 'vacioEventos' }}
        paginacion={
          datos
            ? {
                pagina: datos.pagina,
                porPagina: datos.porPagina,
                total: datos.total,
                onCambio: onPagina,
              }
            : undefined
        }
      />
      <DialogoDetalleEvento
        evento={detalle}
        onCerrar={() => {
          setDetalle(null);
        }}
      />
    </>
  );
}
