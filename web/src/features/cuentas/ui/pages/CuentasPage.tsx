import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatearFecha } from '../../../../l10n/formatos';
import { codigoDe } from '../../../../shared/api/errorApi';
import { rutaDeCuenta } from '../../../../shared/lib/rutas';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { BadgeSuscripcion } from '../../../../shared/ui/atoms/BadgeSuscripcion';
import { BotonIcono } from '../../../../shared/ui/atoms/BotonIcono';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { BarraUso } from '../../../../shared/ui/molecules/BarraUso';
import { Buscador } from '../../../../shared/ui/molecules/Buscador';
import { EncabezadoPagina } from '../../../../shared/ui/molecules/EncabezadoPagina';
import { FiltroSegmentado } from '../../../../shared/ui/molecules/FiltroSegmentado';
import { ListadoPaginado } from '../../../../shared/ui/organisms/ListadoPaginado';
import type { Columna } from '../../../../shared/ui/organisms/TablaDatos';
import { tienePermiso, useSesion } from '../../../seguridad';
import { useCuentas } from '../../application/useCuentas';
import {
  ESTADOS_DEL_FILTRO,
  POR_PAGINA_DE_CUENTAS,
  type CuentaResumen,
  type FiltroEstado,
  type FiltrosDeCuentas,
} from '../../domain/cuenta';
import { RUTAS_DE_CUENTAS } from '../../rutas';
import { DialogoEliminarCuenta } from '../components/DialogoEliminarCuenta';
import styles from './CuentasPage.module.css';

/** Búsqueda, filtro y página viven en la URL: el enlace se puede compartir (ARQUITECTURA_REACT §6). */
function filtrosDeLaUrl(parametros: URLSearchParams): FiltrosDeCuentas {
  const estado = parametros.get('estado');
  return {
    busqueda: parametros.get('q') ?? '',
    estado: ESTADOS_DEL_FILTRO.find((e) => e === estado) ?? 'todas',
    pagina: Math.max(1, Number(parametros.get('pagina') ?? 1) || 1),
  };
}

/** A03: lista de cuentas con búsqueda, filtro por estado con conteos y paginación. */
export function CuentasPage() {
  const { t } = useTranslation(['cuentas', 'comun']);
  const navegar = useNavigate();
  const [parametros, setParametros] = useSearchParams();
  const filtros = filtrosDeLaUrl(parametros);
  const cuentas = useCuentas(filtros);
  const { sesion } = useSesion();
  const permisos = sesion?.permisos ?? [];
  const [aEliminar, setAEliminar] = useState<CuentaResumen | null>(null);
  const irA = (ruta: string) => {
    void navegar(ruta);
  };

  const cambiar = (cambios: Partial<FiltrosDeCuentas>) => {
    const siguiente = { ...filtros, pagina: 1, ...cambios };
    const nuevos = new URLSearchParams();
    if (siguiente.busqueda !== '') nuevos.set('q', siguiente.busqueda);
    if (siguiente.estado !== 'todas') nuevos.set('estado', siguiente.estado);
    if (siguiente.pagina > 1) nuevos.set('pagina', String(siguiente.pagina));
    setParametros(nuevos, { replace: true });
  };

  const irACrear = () => {
    void navegar(RUTAS_DE_CUENTAS.nueva);
  };

  const columnas: Columna<CuentaResumen>[] = [
    {
      id: 'cuenta',
      encabezado: t('cuentas:columna.cuenta'),
      celda: (c) => <strong>{c.nombre}</strong>,
    },
    {
      id: 'codigo',
      encabezado: t('cuentas:columna.codigo'),
      celda: (c) => <TextoMono fuerte>{c.codigo}</TextoMono>,
    },
    {
      id: 'plan',
      encabezado: t('cuentas:columna.plan'),
      secundaria: true,
      celda: (c) => (
        <span className={styles.suave}>
          {c.plan === null
            ? t('cuentas:sinPlan')
            : t('cuentas:usuariosDe', { count: c.plan.cupoUsuarios ?? 0 })}
        </span>
      ),
    },
    {
      id: 'usuarios',
      encabezado: t('cuentas:columna.usuarios'),
      secundaria: true,
      celda: (c) =>
        c.plan?.cupoUsuarios == null ? (
          <TextoMono>{c.usuariosActivos}</TextoMono>
        ) : (
          <BarraUso usados={c.usuariosActivos} cupo={c.plan.cupoUsuarios} />
        ),
    },
    {
      id: 'vence',
      encabezado: t('cuentas:columna.vence'),
      celda: (c) => <TextoMono>{c.venceEl ? formatearFecha(c.venceEl) : '—'}</TextoMono>,
    },
    {
      id: 'estado',
      encabezado: t('cuentas:columna.estado'),
      celda: (c) => <BadgeSuscripcion estado={c.estado} />,
    },
    {
      id: 'acciones',
      encabezado: t('cuentas:columna.acciones'),
      alinear: 'fin',
      // Todo el CRUD desde la fila: ver, ir directo a sus puertas, editar y eliminar.
      celda: (c) => (
        <span className={styles.acciones}>
          <BotonIcono
            icono="visibility"
            accion="ver"
            etiqueta={t('cuentas:ver', { cuenta: c.nombre })}
            onClick={() => {
              irA(RUTAS_DE_CUENTAS.detalle(c.id));
            }}
          />
          <BotonIcono
            icono="door_front"
            accion="neutro"
            etiqueta={t('cuentas:verPuertas', { cuenta: c.nombre })}
            onClick={() => {
              irA(rutaDeCuenta(c.id, 'sitios'));
            }}
          />
          {tienePermiso(permisos, 'seguridad.cuenta.editar') ? (
            <BotonIcono
              icono="edit"
              accion="editar"
              etiqueta={t('cuentas:editar', { cuenta: c.nombre })}
              onClick={() => {
                irA(`${RUTAS_DE_CUENTAS.detalle(c.id)}?editar=1`);
              }}
            />
          ) : null}
          {tienePermiso(permisos, 'seguridad.cuenta.eliminar') ? (
            <BotonIcono
              icono="delete"
              accion="eliminar"
              etiqueta={t('cuentas:eliminar', { cuenta: c.nombre })}
              onClick={() => {
                setAEliminar(c);
              }}
            />
          ) : null}
        </span>
      ),
    },
  ];

  const conteos = cuentas.data?.conteos;
  const hayFiltros = filtros.busqueda !== '' || filtros.estado !== 'todas';

  return (
    <>
      <EncabezadoPagina
        titulo={t('cuentas:titulo')}
        subtitulo={conteos ? t('cuentas:subtitulo', { count: conteos.todas }) : undefined}
        accion={
          <AccesoBoton icono="add" onClick={irACrear}>
            {t('cuentas:crear')}
          </AccesoBoton>
        }
      />
      <div className={styles.barra}>
        <Buscador
          etiqueta={t('cuentas:buscar')}
          placeholder={t('cuentas:buscar')}
          value={filtros.busqueda}
          onChange={(e) => {
            cambiar({ busqueda: e.target.value });
          }}
        />
        <FiltroSegmentado<FiltroEstado>
          etiqueta={t('cuentas:filtroEtiqueta')}
          valor={filtros.estado}
          onCambio={(estado) => {
            cambiar({ estado });
          }}
          opciones={ESTADOS_DEL_FILTRO.map((estado) => ({
            valor: estado,
            etiqueta: t(`cuentas:filtro.${estado}`),
            conteo: conteos?.[estado],
          }))}
        />
      </div>
      <ListadoPaginado
        etiqueta={t('cuentas:tabla')}
        columnas={columnas}
        filas={cuentas.data?.elementos}
        claveDe={(c) => c.id}
        cargando={cuentas.isPending}
        hayError={cuentas.isError}
        errorCode={codigoDe(cuentas.error)}
        onReintentar={() => void cuentas.refetch()}
        tituloError={t('cuentas:errorCarga')}
        vacio={
          hayFiltros
            ? { titulo: t('cuentas:sinResultados.titulo'), texto: t('cuentas:sinResultados.texto') }
            : {
                titulo: t('cuentas:vacio.titulo'),
                texto: t('cuentas:vacio.texto'),
                ilustracion: 'vacioPuertas',
                accion: (
                  <AccesoBoton icono="add" onClick={irACrear}>
                    {t('cuentas:crear')}
                  </AccesoBoton>
                ),
              }
        }
        paginacion={
          cuentas.data
            ? {
                pagina: cuentas.data.pagina,
                porPagina: POR_PAGINA_DE_CUENTAS,
                total: cuentas.data.total,
                onCambio: (pagina) => {
                  cambiar({ pagina });
                },
              }
            : undefined
        }
      />
      {aEliminar ? (
        <DialogoEliminarCuenta
          abierto
          cuenta={{ id: aEliminar.id, nombre: aEliminar.nombre, codigo: aEliminar.codigo }}
          onCerrar={() => {
            setAEliminar(null);
          }}
          onEliminada={() => {
            setAEliminar(null);
          }}
        />
      ) : null}
    </>
  );
}
