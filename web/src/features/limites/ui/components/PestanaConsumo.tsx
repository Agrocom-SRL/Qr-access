import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { formatearMes, formatearPorcentaje } from '../../../../l10n/formatos';
import { codigoDe } from '../../../../shared/api/errorApi';
import { enLista } from '../../../../shared/lib/enumeracion';
import { useDebounce } from '../../../../shared/hooks/useDebounce';
import { rutaDeConsumoCuenta } from '../../../../shared/lib/rutas';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { AccesoSelectorBuscable } from '../../../../shared/ui/molecules/AccesoSelectorBuscable';
import { Buscador } from '../../../../shared/ui/molecules/Buscador';
import { BarraDeFiltros } from '../../../../shared/ui/molecules/BarraDeFiltros';
import { FiltroSegmentado } from '../../../../shared/ui/molecules/FiltroSegmentado';
import { ListadoPaginado } from '../../../../shared/ui/organisms/ListadoPaginado';
import type { Columna } from '../../../../shared/ui/organisms/TablaDatos';
import { useConsumoDeBolsa } from '../../application/useLimites';
import {
  ESTADOS_DE_BOLSA,
  FILTROS_INICIALES_DE_CONSUMO,
  LARGO_MAXIMO_DE_BUSQUEDA,
  ORDENES_DE_CONSUMO,
  type ConsumoDeCuenta,
  type FiltrosDeConsumo,
  type Sentido,
} from '../../domain/consumo';
import { BarraDeBolsa } from './BarraDeBolsa';
import { EstadoDeBolsa } from './EstadoDeBolsa';
import styles from './PestanaConsumo.module.css';

/**
 * Ranking del consumo de la bolsa de todas las cuentas del mes: quién va cerca de su bolsa y quién
 * la superó. Solo muestra; ninguna fila corta ni bloquea a su cuenta (ADR 0030 §2).
 */
export function PestanaConsumo() {
  const { t } = useTranslation(['limites', 'comun']);
  const [filtros, setFiltros] = useState<FiltrosDeConsumo>(FILTROS_INICIALES_DE_CONSUMO);
  const [buscarTexto, setBuscarTexto] = useState('');
  // La búsqueda espera a que la persona deje de escribir: una consulta por tecla saturaría la API.
  const buscarDiferido = useDebounce(buscarTexto);
  const consulta = useConsumoDeBolsa({ ...filtros, buscar: buscarDiferido });
  const listado = consulta.data;
  const hayFiltros = filtros.estado !== 'todos' || buscarDiferido.trim() !== '';
  const totalDeCuentas =
    listado === undefined
      ? undefined
      : ESTADOS_DE_BOLSA.reduce((suma, estado) => suma + listado.porEstado[estado], 0);

  /** Un cambio de filtro vuelve a la primera página: la página vieja puede no existir ya. */
  const cambiarFiltro = (cambios: Partial<FiltrosDeConsumo>) => {
    setFiltros((actual) => ({ ...actual, pagina: 1, ...cambios }));
  };

  const columnas: readonly Columna<ConsumoDeCuenta>[] = [
    {
      id: 'cuenta',
      encabezado: t('limites:columnas.cuenta'),
      celda: (fila) => (
        <Link to={rutaDeConsumoCuenta(fila.cuenta.id)} className={styles.enlace}>
          <TextoMono>{fila.cuenta.codigo}</TextoMono> {fila.cuenta.nombre}
        </Link>
      ),
    },
    {
      id: 'plan',
      encabezado: t('limites:columnas.plan'),
      secundaria: true,
      celda: (fila) => fila.plan ?? t('limites:sinPlan'),
    },
    {
      id: 'consumo',
      encabezado: t('limites:columnas.consumo'),
      celda: (fila) => <BarraDeBolsa consumo={fila} />,
    },
    {
      id: 'estado',
      encabezado: t('limites:columnas.estado'),
      celda: (fila) => <EstadoDeBolsa estado={fila.estado} />,
    },
    {
      id: 'origen',
      encabezado: t('limites:columnas.origen'),
      secundaria: true,
      celda: (fila) =>
        fila.origenDelTope === null
          ? t('comun:sinDato')
          : t(`limites:origen.${fila.origenDelTope}`),
    },
  ];

  return (
    <section className={styles.pestana}>
      {listado ? (
        <p className={styles.resumen}>
          <span>{t('limites:mes', { mes: formatearMes(listado.mes) })}</span>
          <span>
            {t('limites:aviso', { porcentaje: formatearPorcentaje(listado.avisoPorcentaje) })}
          </span>
        </p>
      ) : null}
      <p className={styles.ayuda}>{t('limites:subtitulo')}</p>
      <FiltroSegmentado
        etiqueta={t('limites:filtros.estado')}
        valor={filtros.estado}
        onCambio={(estado) => {
          cambiarFiltro({ estado });
        }}
        opciones={[
          { valor: 'todos', etiqueta: t('limites:filtros.todas'), conteo: totalDeCuentas },
          ...ESTADOS_DE_BOLSA.map((estado) => ({
            valor: estado,
            etiqueta: t(`limites:estado.${estado}`),
            conteo: listado?.porEstado[estado],
          })),
        ]}
      />
      <BarraDeFiltros etiqueta={t('limites:filtros.buscar')}>
        <Buscador
          etiqueta={t('limites:filtros.buscar')}
          placeholder={t('limites:filtros.buscar')}
          maxLength={LARGO_MAXIMO_DE_BUSQUEDA}
          value={buscarTexto}
          onChange={(evento) => {
            setBuscarTexto(evento.target.value);
          }}
        />
        <AccesoSelectorBuscable
          etiqueta={t('limites:filtros.orden')}
          conBusqueda={false}
          valor={filtros.orden}
          opciones={ORDENES_DE_CONSUMO.map((orden) => ({
            valor: orden,
            etiqueta: t(`limites:orden.${orden}`),
          }))}
          onCambio={(valor) => {
            cambiarFiltro({ orden: enLista(ORDENES_DE_CONSUMO, valor, 'porcentaje') });
          }}
        />
        <FiltroSegmentado<Sentido>
          etiqueta={t('limites:filtros.sentido')}
          valor={filtros.sentido}
          onCambio={(sentido) => {
            cambiarFiltro({ sentido });
          }}
          opciones={[
            { valor: 'desc', etiqueta: t('limites:filtros.mayorAMenor') },
            { valor: 'asc', etiqueta: t('limites:filtros.menorAMayor') },
          ]}
        />
      </BarraDeFiltros>
      <ListadoPaginado
        etiqueta={t('limites:tabla')}
        columnas={columnas}
        filas={listado?.elementos}
        claveDe={(fila) => fila.cuenta.id}
        cargando={consulta.isPending}
        hayError={consulta.isError}
        errorCode={codigoDe(consulta.error)}
        onReintentar={() => {
          void consulta.refetch();
        }}
        tituloError={t('limites:errorCarga')}
        vacio={
          hayFiltros
            ? { titulo: t('limites:sinResultados.titulo'), texto: t('limites:sinResultados.texto') }
            : { titulo: t('limites:vacio.titulo'), texto: t('limites:vacio.texto') }
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
