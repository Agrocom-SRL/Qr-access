import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { Skeleton } from '../../../../shared/ui/atoms/Skeleton';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { FiltroSegmentado } from '../../../../shared/ui/molecules/FiltroSegmentado';
import controles from '../../../../shared/ui/molecules/controles.module.css';
import { Paginador } from '../../../../shared/ui/molecules/Paginador';
import { EstadoError } from '../../../../shared/ui/organisms/EstadoError';
import { EstadoVacio } from '../../../../shared/ui/organisms/EstadoVacio';
import {
  useDescartarNotificacion,
  useLeerNotificacion,
  useLeerTodasLasNotificaciones,
  useNotificaciones,
} from '../../application/useNotificaciones';
import {
  TIPOS_DE_NOTIFICACION,
  agruparPorSitio,
  type FiltroDeNotificaciones,
  type TipoDeNotificacion,
} from '../../domain/notificacion';
import { TarjetaDeNotificacion } from './TarjetaDeNotificacion';
import styles from './ListaDeNotificaciones.module.css';

const FILTROS: readonly FiltroDeNotificaciones[] = ['no_leidas', 'todas'];

interface Props {
  /** Leer, descartar y marcar todas son de quien gestiona la bandeja (ADR 0030 §6); la API lo exige igual. */
  puedeGestionar: boolean;
}

/**
 * Los avisos de AGROCOM agrupados por sitio, con filtro por estado y por tipo. Es el contenido de la
 * pantalla de avisos.
 */
export function ListaDeNotificaciones({ puedeGestionar }: Props) {
  const { t } = useTranslation(['notificaciones', 'comun']);
  const [filtro, setFiltro] = useState<FiltroDeNotificaciones>('no_leidas');
  const [tipo, setTipo] = useState<TipoDeNotificacion | ''>('');
  const [pagina, setPagina] = useState(1);
  const consulta = useNotificaciones(filtro, pagina, tipo === '' ? undefined : tipo);
  const leer = useLeerNotificacion();
  const descartar = useDescartarNotificacion();
  const leerTodas = useLeerTodasLasNotificaciones();

  const elementos = consulta.data?.elementos ?? [];
  const grupos = agruparPorSitio(elementos);
  const accionFallida = leer.error ?? descartar.error ?? leerTodas.error;

  /** Un cambio de filtro vuelve a la primera página: la página vieja puede no existir ya. */
  const cambiarFiltro = (nuevo: FiltroDeNotificaciones) => {
    setFiltro(nuevo);
    setPagina(1);
  };
  const cambiarTipo = (nuevo: string) => {
    setTipo(TIPOS_DE_NOTIFICACION.find((valor) => valor === nuevo) ?? '');
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
    <div className={styles.contenido}>
      <div className={styles.barra}>
        <FiltroSegmentado<FiltroDeNotificaciones>
          etiqueta={t('notificaciones:filtro')}
          valor={filtro}
          onCambio={cambiarFiltro}
          opciones={FILTROS.map((valor) => ({
            valor,
            etiqueta: t(`notificaciones:filtros.${valor}`),
          }))}
        />
        <label className={styles.campoTipo}>
          <span className={styles.etiqueta}>{t('notificaciones:filtroTipo')}</span>
          <select
            className={controles.control}
            value={tipo}
            onChange={(evento) => {
              cambiarTipo(evento.target.value);
            }}
          >
            <option value="">{t('notificaciones:todosLosTipos')}</option>
            {TIPOS_DE_NOTIFICACION.map((valor) => (
              <option key={valor} value={valor}>
                {t(`notificaciones:tipo.${valor.replaceAll('.', '_')}`)}
              </option>
            ))}
          </select>
        </label>
        {puedeGestionar ? (
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
        ) : null}
      </div>
      {accionFallida ? (
        <Aviso tono="peligro">{traducirError(t, codigoDe(accionFallida))}</Aviso>
      ) : null}
      <div className={styles.resultados}>{contenido()}</div>
      {consulta.data && consulta.data.total > 0 ? (
        <Paginador
          pagina={consulta.data.pagina}
          porPagina={consulta.data.porPagina}
          total={consulta.data.total}
          onCambio={setPagina}
        />
      ) : null}
    </div>
  );
}
