import { useTranslation } from 'react-i18next';
import { formatearFecha, formatearHora, relacionDeDia } from '../../../../l10n/formatos';
import { codigoDe } from '../../../../shared/api/errorApi';
import type { Paginado } from '../../../../shared/api/tipos';
import { cx } from '../../../../shared/lib/cx';
import { AccesoBadge } from '../../../../shared/ui/atoms/AccesoBadge';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { ListadoPaginado } from '../../../../shared/ui/organisms/ListadoPaginado';
import type { Columna } from '../../../../shared/ui/organisms/TablaDatos';
import type { EventoDeAcceso } from '../../domain/evento';
import { EjecucionDeAcceso } from './EjecucionDeAcceso';
import styles from './TablaEventos.module.css';

interface Props {
  datos: Paginado<EventoDeAcceso> | undefined;
  cargando: boolean;
  error: unknown;
  hayError: boolean;
  onReintentar: () => void;
  onPagina: (pagina: number) => void;
  /** En los accesos de una sola cuenta la columna "Cuenta" sobra. */
  conCuenta: boolean;
  vacio: { titulo: string; texto: string };
}

/** Los intentos de acceso: cuándo, dónde, con qué QR y si se abrió o se rechazó (y por qué). */
export function TablaEventos({
  datos,
  cargando,
  error,
  hayError,
  onReintentar,
  onPagina,
  conCuenta,
  vacio,
}: Props) {
  const { t } = useTranslation(['eventos', 'comun']);

  const cuando = (fecha: Date) => {
    const dia = relacionDeDia(fecha);
    const hora = formatearHora(fecha);
    return dia === 'hoy' ? `${t('comun:hoy')} ${hora}` : `${formatearFecha(fecha)} ${hora}`;
  };

  const columnas: Columna<EventoDeAcceso>[] = [
    {
      id: 'cuando',
      encabezado: t('eventos:columna.cuando'),
      celda: (e) => (
        <span className={styles.suave}>
          <TextoMono>{cuando(e.ocurridoEn)}</TextoMono>
        </span>
      ),
    },
    ...(conCuenta
      ? [
          {
            id: 'cuenta',
            encabezado: t('eventos:columna.cuenta'),
            celda: (e: EventoDeAcceso) => <TextoMono fuerte>{e.cuenta.codigo}</TextoMono>,
          },
        ]
      : []),
    {
      id: 'puerta',
      encabezado: t('eventos:columna.puerta'),
      celda: (e) => (
        <span className={styles.apilado}>
          <strong className={styles.recortado}>{e.puerta.nombre}</strong>
          <span className={styles.suave}>{e.puerta.sitio}</span>
        </span>
      ),
    },
    {
      id: 'lector',
      encabezado: t('eventos:columna.lector'),
      secundaria: true,
      celda: (e) => <span className={styles.suave}>{e.dispositivo ?? '—'}</span>,
    },
    {
      id: 'qr',
      encabezado: t('eventos:columna.qr'),
      secundaria: true,
      celda: (e) => (
        <span className={cx(styles.suave, styles.recortado)}>{e.qrEtiqueta ?? '—'}</span>
      ),
    },
    {
      id: 'resultado',
      encabezado: t('eventos:columna.resultado'),
      celda: (e) =>
        e.resultado === 'permitido' ? (
          <AccesoBadge tono="primario" icono="check_circle">
            {t('eventos:resultado.permitido')}
          </AccesoBadge>
        ) : (
          <AccesoBadge tono="peligro" icono="block">
            {t('eventos:resultado.rechazado')}
          </AccesoBadge>
        ),
    },
    {
      id: 'ejecucion',
      encabezado: t('eventos:columna.ejecucion'),
      celda: (e) => <EjecucionDeAcceso ejecucion={e.ejecucion} causa={e.ejecucionCausa} />,
    },
    {
      id: 'motivo',
      encabezado: t('eventos:columna.motivo'),
      celda: (e) =>
        t(`eventos:motivo.${e.motivoCode.replaceAll('.', '_')}`, {
          defaultValue: t('eventos:motivo.desconocido'),
        }),
    },
  ];

  return (
    <ListadoPaginado
      etiqueta={t('eventos:tabla')}
      columnas={columnas}
      filas={datos?.elementos}
      claveDe={(e) => e.id}
      cargando={cargando}
      hayError={hayError}
      errorCode={codigoDe(error)}
      onReintentar={onReintentar}
      tituloError={t('eventos:errorCarga')}
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
