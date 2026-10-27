import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  formatearDecimal,
  formatearDiaCalendario,
  formatearNumero,
} from '../../../../l10n/formatos';
import { codigoDe } from '../../../../shared/api/errorApi';
import { useDebounce } from '../../../../shared/hooks/useDebounce';
import { enLista } from '../../../../shared/lib/enumeracion';
import { rutaDeFlujoCuenta } from '../../../../shared/lib/rutas';
import { AccesoBadge } from '../../../../shared/ui/atoms/AccesoBadge';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { Buscador } from '../../../../shared/ui/molecules/Buscador';
import { AccesoSelectorBuscable } from '../../../../shared/ui/molecules/AccesoSelectorBuscable';
import { BarraDeFiltros } from '../../../../shared/ui/molecules/BarraDeFiltros';
import { FiltroSegmentado } from '../../../../shared/ui/molecules/FiltroSegmentado';
import { ListadoPaginado } from '../../../../shared/ui/organisms/ListadoPaginado';
import type { Columna } from '../../../../shared/ui/organisms/TablaDatos';
import { useFlujoDeCuentas } from '../../application/useSenales';
import {
  FILTROS_INICIALES_DE_FLUJO,
  LARGO_MAXIMO_DE_BUSQUEDA_FLUJO,
  ORDENES_DE_FLUJO,
  PERIODOS_DE_LA_LISTA,
  type FiltrosDeFlujo,
  type FlujoDeCuenta,
} from '../../domain/flujo';
import type { Sentido } from '../../domain/flujo';
import styles from './PestanaFlujo.module.css';

/**
 * Las cuentas con su flujo de aperturas de hoy y del periodo. Un día atípico cruza a la vez el
 * mínimo de aperturas y el de aperturas por usuario: un pico de un día no es una señal por sí solo,
 * por eso la tabla muestra también cuántos días fueron atípicos y cuál fue el último.
 */
export function PestanaFlujo() {
  const { t, i18n } = useTranslation(['senales', 'comun']);
  const idioma = i18n.language;
  const [filtros, setFiltros] = useState<FiltrosDeFlujo>(FILTROS_INICIALES_DE_FLUJO);
  const [buscarTexto, setBuscarTexto] = useState('');
  const buscarDiferido = useDebounce(buscarTexto);
  const consulta = useFlujoDeCuentas({ ...filtros, buscar: buscarDiferido });
  const listado = consulta.data;
  const hayFiltros = filtros.soloAtipicas || buscarDiferido.trim() !== '';

  /** Un cambio de filtro vuelve a la primera página: la página vieja puede no existir ya. */
  const cambiar = (cambios: Partial<FiltrosDeFlujo>) => {
    setFiltros((actual) => ({ ...actual, pagina: 1, ...cambios }));
  };

  const columnas: readonly Columna<FlujoDeCuenta>[] = [
    {
      id: 'cuenta',
      encabezado: t('senales:flujo.columnas.cuenta'),
      celda: (fila) => (
        <Link to={rutaDeFlujoCuenta(fila.cuenta.id)} className={styles.enlace}>
          <TextoMono>{fila.cuenta.codigo}</TextoMono> {fila.cuenta.nombre}
        </Link>
      ),
    },
    {
      id: 'usuarios',
      encabezado: t('senales:flujo.columnas.usuarios'),
      alinear: 'fin',
      celda: (fila) => <TextoMono>{formatearNumero(fila.usuariosActivos, idioma)}</TextoMono>,
    },
    {
      id: 'aperturas',
      encabezado: t('senales:flujo.columnas.aperturas'),
      alinear: 'fin',
      celda: (fila) => <TextoMono>{formatearNumero(fila.aperturasHoy, idioma)}</TextoMono>,
    },
    {
      id: 'porUsuario',
      encabezado: t('senales:flujo.columnas.porUsuario'),
      alinear: 'fin',
      celda: (fila) => <TextoMono>{formatearDecimal(fila.porUsuarioHoy, idioma)}</TextoMono>,
    },
    {
      id: 'hoy',
      encabezado: t('senales:flujo.columnas.hoy'),
      celda: (fila) =>
        fila.atipicaHoy ? (
          <AccesoBadge tono="advertencia" icono="trending_up">
            {t('senales:flujo.atipico')}
          </AccesoBadge>
        ) : (
          <AccesoBadge tono="primario" icono="check_circle">
            {t('senales:flujo.normal')}
          </AccesoBadge>
        ),
    },
    {
      id: 'diasAtipicos',
      encabezado: t('senales:flujo.columnas.diasAtipicos'),
      alinear: 'fin',
      celda: (fila) => <TextoMono>{formatearNumero(fila.diasAtipicos, idioma)}</TextoMono>,
    },
    {
      id: 'ultimo',
      encabezado: t('senales:flujo.columnas.ultimo'),
      secundaria: true,
      celda: (fila) =>
        fila.ultimoDiaAtipico === null ? (
          t('senales:flujo.ninguno')
        ) : (
          <TextoMono>{formatearDiaCalendario(fila.ultimoDiaAtipico, idioma)}</TextoMono>
        ),
    },
    {
      id: 'base',
      encabezado: t('senales:flujo.columnas.base'),
      secundaria: true,
      alinear: 'fin',
      celda: (fila) =>
        fila.base === null ? (
          t('senales:flujo.sinBase')
        ) : (
          <TextoMono>{formatearDecimal(fila.base, idioma)}</TextoMono>
        ),
    },
    {
      id: 'umbrales',
      encabezado: t('senales:flujo.columnas.umbrales'),
      secundaria: true,
      ajustable: true,
      celda: (fila) =>
        t('senales:flujo.umbrales', {
          aperturas: formatearNumero(fila.umbrales.aperturasMinimo, idioma),
          porUsuario: formatearNumero(fila.umbrales.aperturasPorUsuario, idioma),
        }),
    },
  ];

  return (
    <section className={styles.pestana}>
      <p className={styles.ayuda}>{t('senales:flujo.subtitulo')}</p>
      <BarraDeFiltros etiqueta={t('senales:flujo.filtros.buscar')}>
        <Buscador
          etiqueta={t('senales:flujo.filtros.buscar')}
          placeholder={t('senales:flujo.filtros.buscar')}
          maxLength={LARGO_MAXIMO_DE_BUSQUEDA_FLUJO}
          value={buscarTexto}
          onChange={(evento) => {
            setBuscarTexto(evento.target.value);
          }}
        />
        <AccesoSelectorBuscable
          etiqueta={t('senales:flujo.filtros.orden')}
          conBusqueda={false}
          valor={filtros.orden}
          opciones={ORDENES_DE_FLUJO.map((orden) => ({
            valor: orden,
            etiqueta: t(`senales:flujo.orden.${orden}`),
          }))}
          onCambio={(valor) => {
            cambiar({ orden: enLista(ORDENES_DE_FLUJO, valor, 'por_usuario') });
          }}
        />
        <FiltroSegmentado<Sentido>
          etiqueta={t('senales:flujo.filtros.sentido')}
          valor={filtros.sentido}
          onCambio={(sentido) => {
            cambiar({ sentido });
          }}
          opciones={[
            { valor: 'desc', etiqueta: t('senales:flujo.filtros.mayorAMenor') },
            { valor: 'asc', etiqueta: t('senales:flujo.filtros.menorAMayor') },
          ]}
        />
        <FiltroSegmentado
          etiqueta={t('senales:periodo')}
          valor={String(filtros.dias)}
          onCambio={(valor) => {
            cambiar({ dias: Number(valor) });
          }}
          opciones={PERIODOS_DE_LA_LISTA.map((dias) => ({
            valor: String(dias),
            etiqueta: t('senales:dias', { count: dias }),
          }))}
        />
      </BarraDeFiltros>
      <div className={styles.segmentados}>
        <FiltroSegmentado
          etiqueta={t('senales:flujo.filtros.soloAtipicas')}
          valor={filtros.soloAtipicas ? 'atipicas' : 'todas'}
          onCambio={(valor) => {
            cambiar({ soloAtipicas: valor === 'atipicas' });
          }}
          opciones={[
            { valor: 'todas', etiqueta: t('senales:lista.filtros.todas') },
            { valor: 'atipicas', etiqueta: t('senales:flujo.filtros.atipicas') },
          ]}
        />
      </div>
      <ListadoPaginado
        etiqueta={t('senales:flujo.titulo')}
        columnas={columnas}
        filas={listado?.elementos}
        claveDe={(fila) => fila.cuenta.id}
        cargando={consulta.isPending}
        hayError={consulta.isError}
        errorCode={codigoDe(consulta.error)}
        onReintentar={() => {
          void consulta.refetch();
        }}
        tituloError={t('senales:flujo.errorCarga')}
        vacio={
          hayFiltros
            ? {
                titulo: t('senales:flujo.sinResultados.titulo'),
                texto: t('senales:flujo.sinResultados.texto'),
              }
            : { titulo: t('senales:flujo.vacio.titulo'), texto: t('senales:flujo.vacio.texto') }
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
