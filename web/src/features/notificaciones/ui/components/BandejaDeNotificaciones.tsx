import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { Skeleton } from '../../../../shared/ui/atoms/Skeleton';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { FiltroSegmentado } from '../../../../shared/ui/molecules/FiltroSegmentado';
import { Paginador } from '../../../../shared/ui/molecules/Paginador';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import { EstadoError } from '../../../../shared/ui/organisms/EstadoError';
import { EstadoVacio } from '../../../../shared/ui/organisms/EstadoVacio';
import {
  useDescartarNotificacion,
  useLeerNotificacion,
  useLeerTodasLasNotificaciones,
  useNotificaciones,
} from '../../application/useNotificaciones';
import { agruparPorSitio, type FiltroDeNotificaciones } from '../../domain/notificacion';
import { TarjetaDeNotificacion } from './TarjetaDeNotificacion';
import styles from './BandejaDeNotificaciones.module.css';

const FILTROS: readonly FiltroDeNotificaciones[] = ['no_leidas', 'todas'];

interface Props {
  puedeGestionar: boolean;
  onCerrar: () => void;
}

/**
 * La bandeja de AGROCOM: los avisos de todas las cuentas, agrupados por sitio. Leer, descartar y
 * leer todas son de quien la gestiona (ADR 0030 §6); la API lo exige igual.
 */
export function BandejaDeNotificaciones({ puedeGestionar, onCerrar }: Props) {
  const { t } = useTranslation(['notificaciones', 'comun']);
  const [filtro, setFiltro] = useState<FiltroDeNotificaciones>('no_leidas');
  const [pagina, setPagina] = useState(1);
  const consulta = useNotificaciones(filtro, pagina);
  const leer = useLeerNotificacion();
  const descartar = useDescartarNotificacion();
  const leerTodas = useLeerTodasLasNotificaciones();

  const elementos = consulta.data?.elementos ?? [];
  const grupos = agruparPorSitio(elementos);
  const accionFallida = leer.error ?? descartar.error ?? leerTodas.error;

  const cambiarFiltro = (nuevo: FiltroDeNotificaciones) => {
    setFiltro(nuevo);
    setPagina(1);
  };

  const contenido = () => {
    if (consulta.isPending) {
      return (
        <div className={styles.esqueleto} aria-busy="true">
          <Skeleton ancho="largo" alto="bloque" />
          <Skeleton ancho="largo" alto="bloque" />
        </div>
      );
    }
    if (consulta.isError) {
      return (
        <EstadoError
          titulo={t('notificaciones:errorCarga')}
          code={codigoDe(consulta.error)}
          onReintentar={() => void consulta.refetch()}
        />
      );
    }
    if (elementos.length === 0) {
      const vacio = filtro === 'no_leidas' ? 'noLeidas' : 'todas';
      return (
        <EstadoVacio
          ilustracion="vacioEventos"
          titulo={t(`notificaciones:vacio.${vacio}.titulo`)}
          texto={t(`notificaciones:vacio.${vacio}.texto`)}
        />
      );
    }
    return grupos.map((grupo) => (
      <section key={grupo.clave} className={styles.grupo} aria-labelledby={`grupo-${grupo.clave}`}>
        <header className={styles.cabeceraGrupo}>
          <h3 id={`grupo-${grupo.clave}`} className={styles.nombreSitio}>
            {grupo.sitio?.nombre ?? t('notificaciones:sinSitio')}
          </h3>
          <span className={styles.cuenta}>
            {t('notificaciones:cuentaDelGrupo', {
              codigo: grupo.cuenta.codigo,
              nombre: grupo.cuenta.nombre,
            })}
          </span>
        </header>
        <ul className={styles.lista}>
          {grupo.notificaciones.map((notificacion) => (
            <li key={notificacion.id}>
              <TarjetaDeNotificacion
                notificacion={notificacion}
                puedeGestionar={puedeGestionar}
                onLeer={() => {
                  leer.mutate(notificacion.id);
                }}
                onDescartar={() => {
                  descartar.mutate(notificacion.id);
                }}
              />
            </li>
          ))}
        </ul>
      </section>
    ));
  };

  return (
    <Dialogo
      abierto
      titulo={t('notificaciones:titulo')}
      onCerrar={onCerrar}
      ancho="ancho"
      acciones={
        puedeGestionar ? (
          <AccesoBoton
            variante="tonal"
            icono="done_all"
            cargando={leerTodas.isPending}
            disabled={leerTodas.isPending}
            onClick={() => {
              leerTodas.mutate();
            }}
          >
            {leerTodas.isPending ? t('notificaciones:leyendoTodas') : t('notificaciones:leerTodas')}
          </AccesoBoton>
        ) : undefined
      }
    >
      <p className={styles.subtitulo}>{t('notificaciones:subtitulo')}</p>
      <FiltroSegmentado<FiltroDeNotificaciones>
        etiqueta={t('notificaciones:filtro')}
        valor={filtro}
        onCambio={cambiarFiltro}
        opciones={FILTROS.map((valor) => ({
          valor,
          etiqueta: t(`notificaciones:filtros.${valor}`),
        }))}
      />
      {accionFallida ? (
        <Aviso tono="peligro">{traducirError(t, codigoDe(accionFallida))}</Aviso>
      ) : null}
      <div className={styles.contenido}>{contenido()}</div>
      {consulta.data && consulta.data.total > 0 ? (
        <Paginador
          pagina={consulta.data.pagina}
          porPagina={consulta.data.porPagina}
          total={consulta.data.total}
          onCambio={setPagina}
        />
      ) : null}
    </Dialogo>
  );
}
