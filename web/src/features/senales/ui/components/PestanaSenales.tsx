import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { formatearFecha, formatearHora } from '../../../../l10n/formatos';
import { codigoDe } from '../../../../shared/api/errorApi';
import { enLista } from '../../../../shared/lib/enumeracion';
import { rutaDeCuenta } from '../../../../shared/lib/rutas';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { AccesoCampoFecha } from '../../../../shared/ui/molecules/AccesoCampoFecha';
import { AccesoCampoTexto } from '../../../../shared/ui/molecules/AccesoCampoTexto';
import { AccesoSelectorBuscable } from '../../../../shared/ui/molecules/AccesoSelectorBuscable';
import { BarraDeFiltros } from '../../../../shared/ui/molecules/BarraDeFiltros';
import { FiltroSegmentado } from '../../../../shared/ui/molecules/FiltroSegmentado';
import { ListadoPaginado } from '../../../../shared/ui/organisms/ListadoPaginado';
import type { Columna } from '../../../../shared/ui/organisms/TablaDatos';
import { useOpcionesDeCuenta, useSenalesDeAbuso } from '../../application/useSenales';
import {
  ESTADOS_DE_SENAL,
  FILTROS_INICIALES_DE_SENALES,
  GRAVEDADES,
  TIPOS_DE_SENAL,
  type FiltroDeEstadoSenal,
  type FiltrosDeSenales,
  type Gravedad,
  type SenalDeAbuso,
  type TipoDeSenal,
} from '../../domain/senal';
import { DescripcionDeSenal } from './DescripcionDeSenal';
import { EstadoDeSenal, GravedadDeSenal } from './EtiquetasDeSenal';
import { ResumenDeSenales } from './ResumenDeSenales';
import styles from './PestanaSenales.module.css';

const FILTRO_DE_ESTADO: readonly FiltroDeEstadoSenal[] = ['abiertas', ...ESTADOS_DE_SENAL, 'todas'];

/** Fecha y hora de una señal en la zona de La Paz. */
function cuandoDe(fecha: Date): string {
  return `${formatearFecha(fecha)} ${formatearHora(fecha)}`;
}

/**
 * Las señales de abuso de todas las cuentas, con su resumen por tipo. Cada fila enlaza a la cuenta
 * para que quien revisa vea el contexto antes de decidir; nada de esto corta el acceso.
 */
export function PestanaSenales() {
  const { t } = useTranslation(['senales', 'comun']);
  const [filtros, setFiltros] = useState<FiltrosDeSenales>(FILTROS_INICIALES_DE_SENALES);
  const consulta = useSenalesDeAbuso(filtros);
  const cuentas = useOpcionesDeCuenta();
  const listado = consulta.data;
  const hayFiltros =
    filtros.cuentaId !== null ||
    filtros.usuarioId !== '' ||
    filtros.tipo !== 'todos' ||
    filtros.gravedad !== 'todas' ||
    filtros.estado !== FILTROS_INICIALES_DE_SENALES.estado ||
    filtros.desde !== '' ||
    filtros.hasta !== '';

  /** Un cambio de filtro vuelve a la primera página: la página vieja puede no existir ya. */
  const cambiar = (cambios: Partial<FiltrosDeSenales>) => {
    setFiltros((actual) => ({ ...actual, pagina: 1, ...cambios }));
  };

  const columnas: readonly Columna<SenalDeAbuso>[] = [
    {
      id: 'ocurrio',
      encabezado: t('senales:lista.columnas.ocurrio'),
      celda: (fila) => <TextoMono>{cuandoDe(fila.ocurridaEn)}</TextoMono>,
    },
    {
      id: 'cuenta',
      encabezado: t('senales:lista.columnas.cuenta'),
      celda: (fila) => (
        <Link to={rutaDeCuenta(fila.cuenta.id)} className={styles.enlace}>
          <TextoMono>{fila.cuenta.codigo}</TextoMono> {fila.cuenta.nombre}
        </Link>
      ),
    },
    {
      id: 'usuario',
      encabezado: t('senales:lista.columnas.usuario'),
      secundaria: true,
      celda: (fila) => (
        <>
          {fila.usuario.etiqueta ?? t('senales:lista.usuarioSinNombre')}{' '}
          <TextoMono>#{fila.usuario.id}</TextoMono>
        </>
      ),
    },
    {
      id: 'tipo',
      encabezado: t('senales:lista.columnas.tipo'),
      celda: (fila) => t(`senales:lista.tipo.${fila.tipo}`),
    },
    {
      id: 'gravedad',
      encabezado: t('senales:lista.columnas.gravedad'),
      celda: (fila) => <GravedadDeSenal gravedad={fila.gravedad} />,
    },
    {
      id: 'detalle',
      encabezado: t('senales:lista.columnas.detalle'),
      ajustable: true,
      celda: (fila) => <DescripcionDeSenal tipo={fila.tipo} descripcion={fila.descripcion} />,
    },
    {
      id: 'estado',
      encabezado: t('senales:lista.columnas.estado'),
      celda: (fila) => <EstadoDeSenal estado={fila.estado} />,
    },
  ];

  return (
    <section className={styles.pestana}>
      <ResumenDeSenales />
      <p className={styles.ayuda}>{t('senales:subtitulo')}</p>
      <BarraDeFiltros etiqueta={t('senales:lista.filtros.cuenta')}>
        <AccesoSelectorBuscable
          etiqueta={t('senales:lista.filtros.cuenta')}
          valor={filtros.cuentaId ?? ''}
          opciones={[
            { valor: '', etiqueta: t('senales:lista.filtros.cuentaTodas') },
            ...(cuentas.data ?? []).map((cuenta) => ({
              valor: cuenta.id,
              etiqueta: `${cuenta.codigo} · ${cuenta.nombre}`,
            })),
          ]}
          onCambio={(valor) => {
            cambiar({ cuentaId: valor === '' ? null : valor });
          }}
        />
        <AccesoSelectorBuscable
          etiqueta={t('senales:lista.filtros.tipo')}
          conBusqueda={false}
          valor={filtros.tipo === 'todos' ? '' : filtros.tipo}
          opciones={[
            { valor: '', etiqueta: t('senales:lista.filtros.tipoTodos') },
            ...TIPOS_DE_SENAL.map((tipo) => ({
              valor: tipo,
              etiqueta: t(`senales:lista.tipo.${tipo}`),
            })),
          ]}
          onCambio={(valor) => {
            cambiar({
              tipo: valor === '' ? 'todos' : enLista<TipoDeSenal>(TIPOS_DE_SENAL, valor, 'otro'),
            });
          }}
        />
        <AccesoSelectorBuscable
          etiqueta={t('senales:lista.filtros.estado')}
          conBusqueda={false}
          valor={filtros.estado}
          opciones={FILTRO_DE_ESTADO.map((estado) => ({
            valor: estado,
            etiqueta:
              estado === 'todas'
                ? t('senales:lista.filtros.todas')
                : t(`senales:lista.estado.${estado}`),
          }))}
          onCambio={(valor) => {
            cambiar({ estado: enLista(FILTRO_DE_ESTADO, valor, 'abiertas') });
          }}
        />
        <AccesoCampoTexto
          etiqueta={t('senales:lista.filtros.usuario')}
          inputMode="numeric"
          maxLength={19}
          value={filtros.usuarioId}
          onChange={(evento) => {
            cambiar({ usuarioId: evento.target.value.replace(/\D/g, '') });
          }}
        />
        <AccesoCampoFecha
          limpiable
          etiqueta={t('senales:lista.filtros.desde')}
          valor={filtros.desde}
          onCambio={(desde) => {
            cambiar({ desde });
          }}
        />
        <AccesoCampoFecha
          limpiable
          etiqueta={t('senales:lista.filtros.hasta')}
          valor={filtros.hasta}
          onCambio={(hasta) => {
            cambiar({ hasta });
          }}
        />
      </BarraDeFiltros>
      <div className={styles.segmentados}>
        <FiltroSegmentado<'todas' | Gravedad>
          etiqueta={t('senales:lista.columnas.gravedad')}
          valor={filtros.gravedad}
          onCambio={(gravedad) => {
            cambiar({ gravedad });
          }}
          opciones={[
            { valor: 'todas', etiqueta: t('senales:lista.filtros.todas') },
            ...GRAVEDADES.map((gravedad) => ({
              valor: gravedad,
              etiqueta: t(`senales:lista.gravedad.${gravedad}`),
            })),
          ]}
        />
        {hayFiltros ? (
          <AccesoBoton
            variante="texto"
            icono="close"
            onClick={() => {
              setFiltros(FILTROS_INICIALES_DE_SENALES);
            }}
          >
            {t('senales:lista.filtros.limpiar')}
          </AccesoBoton>
        ) : null}
      </div>
      <ListadoPaginado
        etiqueta={t('senales:lista.titulo')}
        columnas={columnas}
        filas={listado?.elementos}
        claveDe={(fila) => fila.id}
        cargando={consulta.isPending}
        hayError={consulta.isError}
        errorCode={codigoDe(consulta.error)}
        onReintentar={() => {
          void consulta.refetch();
        }}
        tituloError={t('senales:lista.errorCarga')}
        vacio={
          hayFiltros
            ? {
                titulo: t('senales:lista.sinResultados.titulo'),
                texto: t('senales:lista.sinResultados.texto'),
              }
            : { titulo: t('senales:lista.vacio.titulo'), texto: t('senales:lista.vacio.texto') }
        }
        paginacion={
          listado
            ? {
                pagina: listado.pagina,
                porPagina: listado.porPagina,
                total: listado.total,
                onCambio: (pagina) => {
                  setFiltros((actual) => ({ ...actual, pagina }));
                },
              }
            : undefined
        }
      />
    </section>
  );
}
