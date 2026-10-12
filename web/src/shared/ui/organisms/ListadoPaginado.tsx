import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { estadoListado } from '../../lib/estadoListado';
import { useConexion } from '../../hooks/useConexion';
import type { NombreIlustracion } from '../molecules/Ilustracion';
import { Paginador } from '../molecules/Paginador';
import { BannerSinConexion } from './BannerSinConexion';
import { EstadoError } from './EstadoError';
import { EstadoVacio } from './EstadoVacio';
import { TablaDatos, type Columna } from './TablaDatos';

interface Props<T> {
  etiqueta: string;
  columnas: readonly Columna<T>[];
  /** `undefined` mientras no hay respuesta ni caché. */
  filas: readonly T[] | undefined;
  claveDe: (fila: T) => string;
  cargando: boolean;
  /** `code` del error de la API, si la consulta falló. */
  errorCode?: string;
  hayError?: boolean;
  onReintentar: () => void;
  vacio: { titulo: string; texto: string; accion?: ReactNode; ilustracion?: NombreIlustracion };
  tituloError: string;
  paginacion?: { pagina: number; porPagina: number; total: number; onCambio: (p: number) => void };
  /** Hora de los datos en caché, para el banner sin conexión. */
  horaDatos?: string;
}

/**
 * Resuelve los cuatro estados de un listado (carga, vacío, error, sin conexión) para que ninguna
 * página los reimplemente (ARQUITECTURA_REACT §4, README "Estados por listado").
 */
export function ListadoPaginado<T>({
  etiqueta,
  columnas,
  filas,
  claveDe,
  cargando,
  errorCode,
  hayError = false,
  onReintentar,
  vacio,
  tituloError,
  paginacion,
  horaDatos,
}: Props<T>) {
  const { t } = useTranslation('comun');
  const conexion = useConexion();
  const estado = estadoListado({ cargando, error: hayError, cantidad: filas?.length, conexion });

  if (estado === 'sinConexionTotal') {
    return (
      <EstadoVacio
        ilustracion="sinConexion"
        titulo={t('sinConexionTotal.titulo')}
        texto={t('sinConexionTotal.texto')}
      />
    );
  }
  if (estado === 'error') {
    return <EstadoError titulo={tituloError} code={errorCode} onReintentar={onReintentar} />;
  }
  if (estado === 'vacio') {
    return (
      <EstadoVacio
        ilustracion={vacio.ilustracion}
        titulo={vacio.titulo}
        texto={vacio.texto}
        accion={vacio.accion}
      />
    );
  }
  return (
    <>
      {!conexion ? <BannerSinConexion hora={horaDatos} /> : null}
      <TablaDatos
        etiqueta={etiqueta}
        columnas={columnas}
        filas={filas ?? []}
        claveDe={claveDe}
        cargando={estado === 'cargando'}
        pie={paginacion ? <Paginador {...paginacion} /> : undefined}
      />
    </>
  );
}
