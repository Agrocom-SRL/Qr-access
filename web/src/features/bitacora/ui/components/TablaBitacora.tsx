import { useTranslation } from 'react-i18next';
import { formatearFecha, formatearHora, relacionDeDia } from '../../../../l10n/formatos';
import { codigoDe } from '../../../../shared/api/errorApi';
import type { Paginado } from '../../../../shared/api/tipos';
import { AccesoBadge } from '../../../../shared/ui/atoms/AccesoBadge';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { ListadoPaginado } from '../../../../shared/ui/organisms/ListadoPaginado';
import type { Columna } from '../../../../shared/ui/organisms/TablaDatos';
import type { EventoBitacora } from '../../domain/evento';
import { describirEvento } from '../describirEvento';
import styles from './TablaBitacora.module.css';

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
      id: 'antes',
      encabezado: t('bitacora:columna.antes'),
      secundaria: true,
      ajustable: true,
      celda: (e) => <span className={styles.suave}>{describirEvento(e, t).antes}</span>,
    },
    {
      id: 'despues',
      encabezado: t('bitacora:columna.despues'),
      secundaria: true,
      ajustable: true,
      celda: (e) => describirEvento(e, t).despues,
    },
    {
      id: 'origen',
      encabezado: t('bitacora:columna.origen'),
      celda: (e) => <AccesoBadge tono="neutro">{t(`bitacora:origen.${e.canal}`)}</AccesoBadge>,
    },
  ];

  return (
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
  );
}
