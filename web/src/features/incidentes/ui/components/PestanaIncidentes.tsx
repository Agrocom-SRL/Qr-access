import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatearFecha, formatearHora } from '../../../../l10n/formatos';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBadge } from '../../../../shared/ui/atoms/AccesoBadge';
import { BotonIcono } from '../../../../shared/ui/atoms/BotonIcono';
import { Skeleton } from '../../../../shared/ui/atoms/Skeleton';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { AccesoSelectorBuscable } from '../../../../shared/ui/molecules/AccesoSelectorBuscable';
import { Paginador } from '../../../../shared/ui/molecules/Paginador';
import { EstadoError } from '../../../../shared/ui/organisms/EstadoError';
import { EstadoVacio } from '../../../../shared/ui/organisms/EstadoVacio';
import { TablaDatos, type Columna } from '../../../../shared/ui/organisms/TablaDatos';
import { useIncidentesDeCuenta } from '../../application/useIncidentes';
import {
  ESTADOS_DE_INCIDENTE,
  FILTROS_INICIALES_DE_INCIDENTES,
  ORIGENES_DE_INCIDENTE,
  POR_PAGINA_DE_INCIDENTES,
  TIPOS_DE_INCIDENTE,
  TONO_DE_ESTADO,
  TONO_DE_GRAVEDAD,
  type FiltrosDeIncidentes,
  type Incidente,
} from '../../domain/incidente';
import { DialogoDetalleIncidente } from './DialogoDetalleIncidente';
import styles from './PestanaIncidentes.module.css';

/** Fecha y hora en la zona de La Paz, como el resto del panel. */
function cuandoDe(fecha: Date): string {
  return `${formatearFecha(fecha)} ${formatearHora(fecha)}`;
}

/**
 * Pestaña "Incidentes" de la ficha de una cuenta: los casos raros que el sistema o una persona registraron,
 * en solo lectura para AGROCOM (ADR 0033 §4). La resolución la hace quien administra la rama de la cuenta.
 */
export function PestanaIncidentes({ cuentaId }: { cuentaId: string }) {
  const { t } = useTranslation(['incidentes', 'comun']);
  const [filtros, setFiltros] = useState<FiltrosDeIncidentes>(FILTROS_INICIALES_DE_INCIDENTES);
  const [seleccionado, setSeleccionado] = useState<Incidente | null>(null);
  const consulta = useIncidentesDeCuenta(cuentaId, filtros);
  const listado = consulta.data;
  const filas = listado?.elementos ?? [];

  /** Un cambio de filtro vuelve a la primera página: la página vieja puede no existir ya. */
  const cambiar = (cambio: Partial<FiltrosDeIncidentes>) => {
    setFiltros((actuales) => ({ ...actuales, ...cambio, pagina: 1 }));
  };

  const nombreDe = (incidente: Incidente) =>
    incidente.usuario.etiqueta ?? t('incidentes:sinUsuario');

  const columnas: Columna<Incidente>[] = [
    {
      id: 'ocurrido',
      encabezado: t('incidentes:columnas.ocurrido'),
      celda: (fila) => <TextoMono>{cuandoDe(fila.ocurridoEn)}</TextoMono>,
    },
    {
      id: 'usuario',
      encabezado: t('incidentes:columnas.usuario'),
      celda: (fila) => nombreDe(fila),
    },
    {
      id: 'tipo',
      encabezado: t('incidentes:columnas.tipo'),
      celda: (fila) => t(`incidentes:tipo.${fila.tipo}`),
    },
    {
      id: 'gravedad',
      encabezado: t('incidentes:columnas.gravedad'),
      celda: (fila) => (
        <AccesoBadge tono={TONO_DE_GRAVEDAD[fila.gravedad]}>
          {t(`incidentes:gravedad.${fila.gravedad}`)}
        </AccesoBadge>
      ),
    },
    {
      id: 'origen',
      encabezado: t('incidentes:columnas.origen'),
      secundaria: true,
      celda: (fila) => t(`incidentes:origen.${fila.origen}`),
    },
    {
      id: 'estado',
      encabezado: t('incidentes:columnas.estado'),
      celda: (fila) => (
        <AccesoBadge tono={TONO_DE_ESTADO[fila.estado]}>
          {t(`incidentes:estado.${fila.estado}`)}
        </AccesoBadge>
      ),
    },
    {
      id: 'ver',
      encabezado: '',
      alinear: 'fin',
      celda: (fila) => (
        <BotonIcono
          icono="visibility"
          accion="ver"
          etiqueta={t('incidentes:ver', { usuario: nombreDe(fila) })}
          onClick={() => {
            setSeleccionado(fila);
          }}
        />
      ),
    },
  ];

  const contenido = () => {
    if (consulta.isPending) {
      return (
        <div aria-busy="true">
          <Skeleton ancho="largo" alto="bloque" />
        </div>
      );
    }
    if (consulta.isError) {
      return (
        <EstadoError
          titulo={t('incidentes:errorCarga')}
          code={codigoDe(consulta.error)}
          onReintentar={() => void consulta.refetch()}
        />
      );
    }
    if (filas.length === 0) {
      return (
        <EstadoVacio
          ilustracion="vacioEventos"
          titulo={t('incidentes:vacio.titulo')}
          texto={t('incidentes:vacio.texto')}
        />
      );
    }
    return (
      <TablaDatos
        columnas={columnas}
        filas={filas}
        claveDe={(fila) => fila.id}
        etiqueta={t('incidentes:tabla')}
        pie={
          listado !== undefined && listado.total > POR_PAGINA_DE_INCIDENTES ? (
            <Paginador
              pagina={listado.pagina}
              porPagina={listado.porPagina}
              total={listado.total}
              onCambio={(pagina) => {
                setFiltros((actuales) => ({ ...actuales, pagina }));
              }}
            />
          ) : undefined
        }
      />
    );
  };

  return (
    <section className={styles.contenido} aria-labelledby="incidentes-titulo">
      <div>
        <h2 id="incidentes-titulo" className={styles.titulo}>
          {t('incidentes:titulo')}
        </h2>
        <p className={styles.subtitulo}>{t('incidentes:subtitulo')}</p>
      </div>
      <div className={styles.filtros}>
        <div className={styles.campo}>
          <AccesoSelectorBuscable
            conBusqueda={false}
            etiqueta={t('incidentes:filtros.tipo')}
            valor={filtros.tipo}
            opciones={[
              { valor: 'todos', etiqueta: t('incidentes:filtros.todos') },
              ...TIPOS_DE_INCIDENTE.map((valor) => ({
                valor,
                etiqueta: t(`incidentes:tipo.${valor}`),
              })),
            ]}
            onCambio={(valor) => {
              cambiar({ tipo: valor as FiltrosDeIncidentes['tipo'] });
            }}
          />
        </div>
        <div className={styles.campo}>
          <AccesoSelectorBuscable
            conBusqueda={false}
            etiqueta={t('incidentes:filtros.origen')}
            valor={filtros.origen}
            opciones={[
              { valor: 'todos', etiqueta: t('incidentes:filtros.todos') },
              ...ORIGENES_DE_INCIDENTE.map((valor) => ({
                valor,
                etiqueta: t(`incidentes:origen.${valor}`),
              })),
            ]}
            onCambio={(valor) => {
              cambiar({ origen: valor as FiltrosDeIncidentes['origen'] });
            }}
          />
        </div>
        <div className={styles.campo}>
          <AccesoSelectorBuscable
            conBusqueda={false}
            etiqueta={t('incidentes:filtros.estado')}
            valor={filtros.estado}
            opciones={[
              { valor: 'todos', etiqueta: t('incidentes:filtros.todos') },
              ...ESTADOS_DE_INCIDENTE.map((valor) => ({
                valor,
                etiqueta: t(`incidentes:estado.${valor}`),
              })),
            ]}
            onCambio={(valor) => {
              cambiar({ estado: valor as FiltrosDeIncidentes['estado'] });
            }}
          />
        </div>
      </div>
      {contenido()}
      {seleccionado ? (
        <DialogoDetalleIncidente
          cuentaId={cuentaId}
          incidente={seleccionado}
          onCerrar={() => {
            setSeleccionado(null);
          }}
        />
      ) : null}
    </section>
  );
}
