import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { AccesoSelectorBuscable } from '../../../../shared/ui/molecules/AccesoSelectorBuscable';
import { AccesoCampoFecha } from '../../../../shared/ui/molecules/AccesoCampoFecha';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { tienePermiso, useSesion } from '../../../seguridad';
import { useDescargarPagina } from '../../application/useExportacion';
import {
  FILTROS_INICIALES_DE_EXPORTACION,
  PERMISO_EXPORTAR_DE_CUENTA,
  RECURSOS_EXPORTABLES,
  claveDeExportacion,
  paginaSiguiente,
  paginasDe,
  rangoValido,
  type FiltrosDeExportacion,
  type RecursoExportable,
  type ResumenDePagina,
  type ResultadoDeFiltro,
} from '../../domain/exportacion';
import styles from './PanelExportacion.module.css';

interface Props {
  cuenta: { id: string; codigo: string };
}

/** La última página bajada y la clave de recurso y filtros con que se bajó: solo vale mientras no cambien. */
interface UltimaPagina {
  clave: string;
  resumen: ResumenDePagina;
}

/**
 * Exporta los datos de la cuenta en CSV, una página a la vez (ADR 0033 §3). Cada descarga trae hasta el máximo
 * por página; si hay más, el botón baja la siguiente. Si el tope de la exportación corta el total, lo dice y
 * sugiere acotar el rango de fechas. Sin el permiso no se muestra nada.
 */
export function PanelExportacion({ cuenta }: Props) {
  const { t } = useTranslation(['exportacion', 'comun', 'errores']);
  const { sesion } = useSesion();
  const [recurso, setRecurso] = useState<RecursoExportable>('usuarios');
  const [filtros, setFiltros] = useState<FiltrosDeExportacion>(FILTROS_INICIALES_DE_EXPORTACION);
  const [ultima, setUltima] = useState<UltimaPagina | null>(null);
  const descargar = useDescargarPagina(cuenta.id, cuenta.codigo);

  if (!tienePermiso(sesion?.permisos ?? [], PERMISO_EXPORTAR_DE_CUENTA)) return null;

  const clave = claveDeExportacion(recurso, filtros);
  // Una página bajada con otros filtros no sirve para seguir: se descarta al comparar las claves.
  const vigente = ultima?.clave === clave ? ultima.resumen : null;
  const rango = rangoValido(filtros);
  const pagina = paginaSiguiente(vigente);
  const paginas = vigente ? paginasDe(vigente.total, vigente.porPagina) : 0;

  const cambiarRecurso = (valor: RecursoExportable) => {
    setRecurso(valor);
    setUltima(null);
    descargar.reset();
  };

  const cambiarFiltros = (cambio: Partial<FiltrosDeExportacion>) => {
    setFiltros((actuales) => ({ ...actuales, ...cambio }));
    setUltima(null);
    descargar.reset();
  };

  const descargarPagina = () => {
    descargar.mutate(
      { recurso, pagina, filtros },
      {
        onSuccess: (resumen) => {
          setUltima({ clave: claveDeExportacion(recurso, filtros), resumen });
        },
      },
    );
  };

  const etiquetaDelBoton = vigente
    ? vigente.hayMas
      ? t('exportacion:siguiente', { pagina, paginas })
      : t('exportacion:descargarDeNuevo')
    : t('exportacion:descargar');

  return (
    <section className={styles.seccion} aria-labelledby="exportacion-titulo">
      <h2 id="exportacion-titulo" className={styles.titulo}>
        {t('exportacion:titulo')}
      </h2>
      <p className={styles.texto}>{t('exportacion:subtitulo')}</p>
      <div className={styles.filtros}>
        <div className={styles.campo}>
          <AccesoSelectorBuscable
            conBusqueda={false}
            etiqueta={t('exportacion:recurso.etiqueta')}
            valor={recurso}
            opciones={RECURSOS_EXPORTABLES.map((valor) => ({
              valor,
              etiqueta: t(`exportacion:recurso.${valor}`),
            }))}
            onCambio={(valor) => {
              cambiarRecurso(valor as RecursoExportable);
            }}
          />
        </div>
        {recurso === 'lecturas' ? (
          <>
            <div className={styles.campo}>
              <AccesoSelectorBuscable
                conBusqueda={false}
                etiqueta={t('exportacion:filtros.resultado')}
                valor={filtros.resultado}
                opciones={[
                  { valor: 'todos', etiqueta: t('exportacion:filtros.todos') },
                  { valor: 'permitido', etiqueta: t('exportacion:filtros.permitido') },
                  { valor: 'rechazado', etiqueta: t('exportacion:filtros.rechazado') },
                ]}
                onCambio={(valor) => {
                  cambiarFiltros({ resultado: valor as ResultadoDeFiltro });
                }}
              />
            </div>
            <AccesoCampoFecha
              etiqueta={t('exportacion:filtros.desde')}
              valor={filtros.desde}
              limpiable
              onCambio={(valor) => {
                cambiarFiltros({ desde: valor });
              }}
            />
            <AccesoCampoFecha
              etiqueta={t('exportacion:filtros.hasta')}
              valor={filtros.hasta}
              limpiable
              error={rango ? undefined : t('exportacion:filtros.rangoInvalido')}
              onCambio={(valor) => {
                cambiarFiltros({ hasta: valor });
              }}
            />
          </>
        ) : null}
      </div>
      <div>
        <AccesoBoton
          icono="download"
          cargando={descargar.isPending}
          disabled={!rango}
          onClick={descargarPagina}
        >
          {etiquetaDelBoton}
        </AccesoBoton>
      </div>
      {descargar.isError ? (
        <Aviso tono="peligro">{traducirError(t, codigoDe(descargar.error))}</Aviso>
      ) : null}
      {vigente && vigente.total === 0 ? (
        <Aviso tono="informacion">{t('exportacion:sinFilas')}</Aviso>
      ) : null}
      {vigente && vigente.total > 0 ? (
        <Aviso tono="exito">
          {t('exportacion:descargada', {
            pagina: vigente.pagina,
            paginas,
            count: vigente.filas,
          })}
        </Aviso>
      ) : null}
      {vigente?.truncado ? <Aviso tono="advertencia">{t('exportacion:truncado')}</Aviso> : null}
    </section>
  );
}
