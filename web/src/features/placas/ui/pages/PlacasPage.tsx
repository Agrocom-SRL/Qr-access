import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { formatearFecha, formatearHora, relacionDeDia } from '../../../../l10n/formatos';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBadge } from '../../../../shared/ui/atoms/AccesoBadge';
import { BotonIcono } from '../../../../shared/ui/atoms/BotonIcono';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { Buscador } from '../../../../shared/ui/molecules/Buscador';
import { EncabezadoPagina } from '../../../../shared/ui/molecules/EncabezadoPagina';
import { FiltroSegmentado } from '../../../../shared/ui/molecules/FiltroSegmentado';
import { ConfirmarDialogo } from '../../../../shared/ui/organisms/ConfirmarDialogo';
import { ListadoPaginado } from '../../../../shared/ui/organisms/ListadoPaginado';
import type { Columna } from '../../../../shared/ui/organisms/TablaDatos';
import {
  useCancelarVinculoDePlaca,
  useDarDeBajaPlaca,
  useLiberarPlaca,
  usePlacas,
} from '../../application/usePlacas';
import {
  FILTROS_DE_ESTADO,
  POR_PAGINA_DE_PLACAS,
  minutosRestantes,
  puedeCancelarVinculo,
  puedeDarDeBaja,
  puedeLiberar,
  puedeVincular,
  type FiltrosDePlacas,
  type Placa,
} from '../../domain/placa';
import { DialogoVincularPlaca } from '../components/DialogoVincularPlaca';
import styles from './PlacasPage.module.css';

/** Búsqueda, filtro y página viven en la URL: el enlace se puede compartir. */
function filtrosDeLaUrl(parametros: URLSearchParams): FiltrosDePlacas {
  const estado = parametros.get('estado');
  return {
    busqueda: parametros.get('q') ?? '',
    estado: FILTROS_DE_ESTADO.find((e) => e === estado) ?? 'todas',
    pagina: Math.max(1, Number(parametros.get('pagina') ?? 1) || 1),
  };
}

/** Inventario de placas: estado, a quién sirven y las acciones de vincular, liberar y dar de baja (ADR 0026). */
export function PlacasPage() {
  const { t } = useTranslation(['placas', 'comun']);
  const [parametros, setParametros] = useSearchParams();
  const filtros = filtrosDeLaUrl(parametros);
  const placas = usePlacas(filtros);
  const liberar = useLiberarPlaca();
  const darDeBaja = useDarDeBajaPlaca();
  const cancelarVinculo = useCancelarVinculoDePlaca();
  const [aVincular, setAVincular] = useState<Placa | null>(null);
  const [aLiberar, setALiberar] = useState<Placa | null>(null);
  const [aDarDeBaja, setADarDeBaja] = useState<Placa | null>(null);

  const cambiar = (cambios: Partial<FiltrosDePlacas>) => {
    const siguiente = { ...filtros, pagina: 1, ...cambios };
    const nuevos = new URLSearchParams();
    if (siguiente.busqueda !== '') nuevos.set('q', siguiente.busqueda);
    if (siguiente.estado !== 'todas') nuevos.set('estado', siguiente.estado);
    if (siguiente.pagina > 1) nuevos.set('pagina', String(siguiente.pagina));
    setParametros(nuevos, { replace: true });
  };

  const contacto = (placa: Placa) => {
    if (placa.ultimoContactoEn === null) return t('placas:nunca');
    const dia = relacionDeDia(placa.ultimoContactoEn);
    const hora = formatearHora(placa.ultimoContactoEn);
    if (dia === 'hoy') return `${t('comun:hoy')} ${hora}`;
    if (dia === 'ayer') return `${t('comun:ayer')} ${hora}`;
    return formatearFecha(placa.ultimoContactoEn);
  };

  const columnas: Columna<Placa>[] = [
    {
      id: 'mac',
      encabezado: t('placas:columna.mac'),
      celda: (p) => <TextoMono fuerte>{p.mac}</TextoMono>,
    },
    {
      id: 'estado',
      encabezado: t('placas:columna.estado'),
      celda: (p) =>
        p.estado === 'vinculada' ? (
          <AccesoBadge tono="primario" icono="link">
            {t('placas:badge.vinculada')}
          </AccesoBadge>
        ) : p.estado === 'por_confirmar' ? (
          <span className={styles.asignada}>
            <AccesoBadge tono="advertencia" icono="pending_actions">
              {t('placas:badge.porConfirmar')}
            </AccesoBadge>
            {p.porConfirmarHasta ? (
              <span className={styles.suave}>
                {t('placas:minutosRestantes', {
                  count: minutosRestantes(p.porConfirmarHasta, new Date()),
                })}
              </span>
            ) : null}
          </span>
        ) : (
          <AccesoBadge tono="informacion" icono="check_circle">
            {t('placas:badge.detectada')}
          </AccesoBadge>
        ),
    },
    {
      id: 'asignada',
      encabezado: t('placas:columna.asignada'),
      celda: (p) =>
        p.cuenta === null || p.puerta === null ? (
          <span className={styles.suave}>{t('placas:sinAsignar')}</span>
        ) : (
          <span className={styles.asignada}>
            <strong>{p.puerta.nombre}</strong>
            <span className={styles.suave}>{`${p.cuenta.codigo} · ${p.cuenta.nombre}`}</span>
          </span>
        ),
    },
    {
      id: 'conexion',
      encabezado: t('placas:columna.contacto'),
      celda: (p) => (
        <span className={styles.asignada}>
          {p.enLinea ? (
            <AccesoBadge tono="primario" icono="wifi">
              {t('placas:conexion.enLinea')}
            </AccesoBadge>
          ) : (
            <AccesoBadge tono="advertencia" icono="wifi_off">
              {t('placas:conexion.sinConexion')}
            </AccesoBadge>
          )}
          <TextoMono>{contacto(p)}</TextoMono>
        </span>
      ),
    },
    {
      id: 'firmware',
      encabezado: t('placas:columna.firmware'),
      secundaria: true,
      celda: (p) => <TextoMono>{p.firmware ?? '—'}</TextoMono>,
    },
    {
      id: 'accion',
      encabezado: t('placas:columna.accion'),
      alinear: 'fin',
      celda: (p) => (
        <span className={styles.acciones}>
          {puedeVincular(p) ? (
            <BotonIcono
              icono="link"
              accion="editar"
              etiqueta={t('placas:vincularA', { mac: p.mac })}
              onClick={() => {
                setAVincular(p);
              }}
            />
          ) : null}
          {puedeCancelarVinculo(p) ? (
            <BotonIcono
              icono="close"
              accion="eliminar"
              etiqueta={t('placas:cancelarVinculoA', { mac: p.mac })}
              onClick={() => {
                cancelarVinculo.mutate(p.id);
              }}
            />
          ) : null}
          {puedeLiberar(p) ? (
            <BotonIcono
              icono="link_off"
              accion="eliminar"
              etiqueta={t('placas:liberarA', { mac: p.mac })}
              onClick={() => {
                setALiberar(p);
              }}
            />
          ) : null}
          {puedeDarDeBaja(p) ? (
            <BotonIcono
              icono="delete"
              accion="eliminar"
              etiqueta={t('placas:darDeBajaA', { mac: p.mac })}
              onClick={() => {
                setADarDeBaja(p);
              }}
            />
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <>
      <EncabezadoPagina
        titulo={t('placas:titulo')}
        subtitulo={placas.data ? t('placas:subtitulo', { count: placas.data.total }) : undefined}
      />
      <div className={styles.barra}>
        <Buscador
          className={styles.buscador}
          etiqueta={t('placas:buscar')}
          placeholder={t('placas:buscar')}
          value={filtros.busqueda}
          onChange={(e) => {
            cambiar({ busqueda: e.target.value });
          }}
        />
        <FiltroSegmentado
          etiqueta={t('placas:filtro')}
          valor={filtros.estado}
          onCambio={(estado) => {
            cambiar({ estado });
          }}
          opciones={FILTROS_DE_ESTADO.map((valor) => ({
            valor,
            etiqueta: t(`placas:estado.${valor}`),
          }))}
        />
      </div>
      {liberar.isError || darDeBaja.isError || cancelarVinculo.isError ? (
        <Aviso tono="peligro">
          {traducirError(t, codigoDe(liberar.error ?? darDeBaja.error ?? cancelarVinculo.error))}
        </Aviso>
      ) : null}
      <ListadoPaginado
        etiqueta={t('placas:tabla')}
        columnas={columnas}
        filas={placas.data?.elementos}
        claveDe={(p) => p.id}
        cargando={placas.isPending}
        hayError={placas.isError}
        errorCode={codigoDe(placas.error)}
        onReintentar={() => void placas.refetch()}
        tituloError={t('placas:errorCarga')}
        vacio={{
          titulo: t('placas:vacio.titulo'),
          texto: t('placas:vacio.texto'),
          ilustracion: 'vacioPuertas',
        }}
        paginacion={
          placas.data
            ? {
                pagina: placas.data.pagina,
                porPagina: POR_PAGINA_DE_PLACAS,
                total: placas.data.total,
                onCambio: (pagina) => {
                  cambiar({ pagina });
                },
              }
            : undefined
        }
      />
      {aVincular ? (
        <DialogoVincularPlaca
          placa={aVincular}
          onCerrar={() => {
            setAVincular(null);
          }}
        />
      ) : null}
      <ConfirmarDialogo
        abierto={aLiberar !== null}
        titulo={t('placas:liberarTitulo', { mac: aLiberar?.mac ?? '' })}
        texto={t('placas:liberarTexto')}
        etiquetaConfirmar={liberar.isPending ? t('placas:liberando') : t('placas:liberar')}
        cargando={liberar.isPending}
        peligro
        onConfirmar={() => {
          if (aLiberar) {
            liberar.mutate(aLiberar.id, {
              onSettled: () => {
                setALiberar(null);
              },
            });
          }
        }}
        onCancelar={() => {
          setALiberar(null);
        }}
      />
      <ConfirmarDialogo
        abierto={aDarDeBaja !== null}
        titulo={t('placas:bajaTitulo', { mac: aDarDeBaja?.mac ?? '' })}
        texto={t('placas:bajaTexto')}
        etiquetaConfirmar={darDeBaja.isPending ? t('placas:dandoDeBaja') : t('placas:darDeBaja')}
        cargando={darDeBaja.isPending}
        peligro
        onConfirmar={() => {
          if (aDarDeBaja) {
            darDeBaja.mutate(aDarDeBaja.id, {
              onSettled: () => {
                setADarDeBaja(null);
              },
            });
          }
        }}
        onCancelar={() => {
          setADarDeBaja(null);
        }}
      />
    </>
  );
}
