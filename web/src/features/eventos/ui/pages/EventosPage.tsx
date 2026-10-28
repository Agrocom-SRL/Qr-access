import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { AccesoCampoFecha } from '../../../../shared/ui/molecules/AccesoCampoFecha';
import { AccesoSelectorBuscable } from '../../../../shared/ui/molecules/AccesoSelectorBuscable';
import { EncabezadoPagina } from '../../../../shared/ui/molecules/EncabezadoPagina';
import { FiltroSegmentado } from '../../../../shared/ui/molecules/FiltroSegmentado';
import { useCuentasDeLosEventos, useEventos } from '../../application/useEventos';
import {
  FILTROS_DE_EJECUCION,
  FILTROS_DE_RESULTADO,
  POR_PAGINA_DE_EVENTOS,
  type FiltrosDeEventos,
} from '../../domain/evento';
import { TablaEventos } from '../components/TablaEventos';
import styles from './EventosPage.module.css';

/** Filtros y página en la URL (`?cuenta=…&resultado=…&ejecucion=…&desde=…&hasta=…&pagina=…`): el enlace se puede compartir. */
function filtrosDeLaUrl(parametros: URLSearchParams): FiltrosDeEventos {
  return {
    cuentaId: parametros.get('cuenta'),
    resultado: FILTROS_DE_RESULTADO.find((r) => r === parametros.get('resultado')) ?? 'todos',
    ejecucion: FILTROS_DE_EJECUCION.find((e) => e === parametros.get('ejecucion')) ?? 'todas',
    desde: parametros.get('desde') ?? '',
    hasta: parametros.get('hasta') ?? '',
    pagina: Math.max(1, Number(parametros.get('pagina') ?? 1) || 1),
  };
}

/** Los accesos (lecturas de QR) de todas las cuentas, o de una, que se actualizan solos. */
export function EventosPage() {
  const { t } = useTranslation(['eventos', 'bitacora']);
  const [parametros, setParametros] = useSearchParams();
  const filtros = filtrosDeLaUrl(parametros);
  const consulta = useEventos(filtros, POR_PAGINA_DE_EVENTOS);
  const cuentas = useCuentasDeLosEventos();

  const cambiar = (cambios: Partial<FiltrosDeEventos>) => {
    const siguiente = { ...filtros, pagina: 1, ...cambios };
    const nuevos = new URLSearchParams();
    if (siguiente.cuentaId) nuevos.set('cuenta', siguiente.cuentaId);
    if (siguiente.resultado !== 'todos') nuevos.set('resultado', siguiente.resultado);
    if (siguiente.ejecucion !== 'todas') nuevos.set('ejecucion', siguiente.ejecucion);
    if (siguiente.desde !== '') nuevos.set('desde', siguiente.desde);
    if (siguiente.hasta !== '') nuevos.set('hasta', siguiente.hasta);
    if (siguiente.pagina > 1) nuevos.set('pagina', String(siguiente.pagina));
    setParametros(nuevos, { replace: true });
  };

  const hayFiltros =
    filtros.cuentaId !== null ||
    filtros.resultado !== 'todos' ||
    filtros.ejecucion !== 'todas' ||
    filtros.desde !== '' ||
    filtros.hasta !== '';
  return (
    <>
      <EncabezadoPagina titulo={t('eventos:titulo')} subtitulo={t('eventos:subtitulo')} />
      <div className={styles.filtros}>
        <AccesoSelectorBuscable
          etiqueta={t('eventos:filtros.cuenta')}
          valor={filtros.cuentaId ?? ''}
          opciones={[
            { valor: '', etiqueta: t('eventos:filtros.todas') },
            ...(cuentas.data ?? []).map((c) => ({
              valor: c.id,
              etiqueta: `${c.codigo} · ${c.nombre}`,
            })),
          ]}
          onCambio={(valor) => {
            cambiar({ cuentaId: valor === '' ? null : valor });
          }}
        />
        <AccesoCampoFecha
          limpiable
          etiqueta={t('bitacora:filtros.desde')}
          valor={filtros.desde}
          onCambio={(desde) => {
            cambiar({ desde });
          }}
        />
        <AccesoCampoFecha
          limpiable
          etiqueta={t('bitacora:filtros.hasta')}
          valor={filtros.hasta}
          onCambio={(hasta) => {
            cambiar({ hasta });
          }}
        />
      </div>
      <div className={styles.segmentados}>
        <FiltroSegmentado
          etiqueta={t('eventos:filtros.resultado')}
          valor={filtros.resultado}
          onCambio={(resultado) => {
            cambiar({ resultado });
          }}
          opciones={FILTROS_DE_RESULTADO.map((valor) => ({
            valor,
            etiqueta: t(`eventos:filtros.${valor}`),
          }))}
        />
        <FiltroSegmentado
          etiqueta={t('eventos:filtros.ejecucionEtiqueta')}
          valor={filtros.ejecucion}
          onCambio={(ejecucion) => {
            cambiar({ ejecucion });
          }}
          opciones={FILTROS_DE_EJECUCION.map((valor) => ({
            valor,
            etiqueta: t(`eventos:ejecucionFiltro.${valor}`),
          }))}
        />
      </div>
      <TablaEventos
        datos={consulta.data}
        cargando={consulta.isPending}
        error={consulta.error}
        hayError={consulta.isError}
        onReintentar={() => void consulta.refetch()}
        onPagina={(pagina) => {
          cambiar({ pagina });
        }}
        conCuenta
        vacio={
          hayFiltros
            ? { titulo: t('eventos:sinResultados.titulo'), texto: t('eventos:sinResultados.texto') }
            : { titulo: t('eventos:vacio.titulo'), texto: t('eventos:vacio.texto') }
        }
      />
    </>
  );
}
