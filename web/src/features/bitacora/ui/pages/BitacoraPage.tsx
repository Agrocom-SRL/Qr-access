import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { AccesoCampoFecha } from '../../../../shared/ui/molecules/AccesoCampoFecha';
import { AccesoSelectorBuscable } from '../../../../shared/ui/molecules/AccesoSelectorBuscable';
import { EncabezadoPagina } from '../../../../shared/ui/molecules/EncabezadoPagina';
import { useBitacora, useCuentasDeLaBitacora } from '../../application/useBitacora';
import { ACCIONES, POR_PAGINA_DE_BITACORA, type FiltrosDeBitacora } from '../../domain/evento';
import { TablaBitacora } from '../components/TablaBitacora';
import styles from './BitacoraPage.module.css';

/** Filtros y página en la URL (`?cuenta=…&accion=…&desde=…&hasta=…&pagina=…`): el enlace se puede compartir. */
function filtrosDeLaUrl(parametros: URLSearchParams): FiltrosDeBitacora {
  const accion = parametros.get('accion');
  return {
    cuentaId: parametros.get('cuenta'),
    accion: ACCIONES.find((a) => a === accion) ?? null,
    desde: parametros.get('desde') ?? '',
    hasta: parametros.get('hasta') ?? '',
    pagina: Math.max(1, Number(parametros.get('pagina') ?? 1) || 1),
  };
}

/** A10: la bitácora de toda la plataforma, filtrable por cuenta, acción y fechas. */
export function BitacoraPage() {
  const { t } = useTranslation(['bitacora', 'comun']);
  const [parametros, setParametros] = useSearchParams();
  const filtros = filtrosDeLaUrl(parametros);
  const consulta = useBitacora(filtros, POR_PAGINA_DE_BITACORA);
  const cuentas = useCuentasDeLaBitacora();

  const cambiar = (cambios: Partial<FiltrosDeBitacora>) => {
    const siguiente = { ...filtros, pagina: 1, ...cambios };
    const nuevos = new URLSearchParams();
    if (siguiente.cuentaId) nuevos.set('cuenta', siguiente.cuentaId);
    if (siguiente.accion) nuevos.set('accion', siguiente.accion);
    if (siguiente.desde !== '') nuevos.set('desde', siguiente.desde);
    if (siguiente.hasta !== '') nuevos.set('hasta', siguiente.hasta);
    if (siguiente.pagina > 1) nuevos.set('pagina', String(siguiente.pagina));
    setParametros(nuevos, { replace: true });
  };

  const hayFiltros =
    filtros.cuentaId !== null ||
    filtros.accion !== null ||
    filtros.desde !== '' ||
    filtros.hasta !== '';
  return (
    <>
      <EncabezadoPagina titulo={t('bitacora:titulo')} subtitulo={t('bitacora:subtitulo')} />
      <div className={styles.filtros}>
        <AccesoSelectorBuscable
          etiqueta={t('bitacora:filtros.cuenta')}
          valor={filtros.cuentaId ?? ''}
          opciones={[
            { valor: '', etiqueta: t('bitacora:filtros.todas') },
            ...(cuentas.data ?? []).map((c) => ({
              valor: c.id,
              etiqueta: `${c.codigo} · ${c.nombre}`,
            })),
          ]}
          onCambio={(valor) => {
            cambiar({ cuentaId: valor === '' ? null : valor });
          }}
        />
        <AccesoSelectorBuscable
          conBusqueda={false}
          etiqueta={t('bitacora:filtros.accion')}
          valor={filtros.accion ?? ''}
          opciones={[
            { valor: '', etiqueta: t('bitacora:filtros.todos') },
            ...ACCIONES.map((a) => ({ valor: a, etiqueta: t(`bitacora:acciones.${a}`) })),
          ]}
          onCambio={(valor) => {
            cambiar({ accion: ACCIONES.find((a) => a === valor) ?? null });
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
      <TablaBitacora
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
            ? {
                titulo: t('bitacora:sinResultados.titulo'),
                texto: t('bitacora:sinResultados.texto'),
              }
            : { titulo: t('bitacora:vacio.titulo'), texto: t('bitacora:vacio.texto') }
        }
      />
    </>
  );
}
