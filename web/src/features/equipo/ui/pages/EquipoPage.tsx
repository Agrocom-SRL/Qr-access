import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatearFecha, formatearHora, relacionDeDia } from '../../../../l10n/formatos';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBadge } from '../../../../shared/ui/atoms/AccesoBadge';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { BotonIcono } from '../../../../shared/ui/atoms/BotonIcono';
import { Avatar } from '../../../../shared/ui/atoms/Avatar';
import { Icono } from '../../../../shared/ui/atoms/Icono';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { EncabezadoPagina } from '../../../../shared/ui/molecules/EncabezadoPagina';
import { ConfirmarDialogo } from '../../../../shared/ui/organisms/ConfirmarDialogo';
import { ListadoPaginado } from '../../../../shared/ui/organisms/ListadoPaginado';
import type { Columna } from '../../../../shared/ui/organisms/TablaDatos';
import { useDesactivarMiembro, useEquipo, useReactivarMiembro } from '../../application/useEquipo';
import { puedeDesactivar, puedeReactivar, type MiembroEquipo } from '../../domain/equipo';
import { DialogoAgregarMiembro } from '../components/DialogoAgregarMiembro';
import { DialogoEditarMiembro } from '../components/DialogoEditarMiembro';
import styles from './EquipoPage.module.css';

/** A11: el equipo AGROCOM con sus cuatro estados, agregar (A11b) y desactivar con confirmación. */
export function EquipoPage() {
  const { t } = useTranslation(['equipo', 'comun']);
  const equipo = useEquipo();
  const desactivar = useDesactivarMiembro();
  const reactivar = useReactivarMiembro();
  const [aEditar, setAEditar] = useState<MiembroEquipo | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [aDesactivar, setADesactivar] = useState<MiembroEquipo | null>(null);

  const ultimoIngreso = (miembro: MiembroEquipo) => {
    if (miembro.ultimoIngresoEn === null) return t('equipo:nuncaIngreso');
    const dia = relacionDeDia(miembro.ultimoIngresoEn);
    const hora = formatearHora(miembro.ultimoIngresoEn);
    if (dia === 'hoy') return `${t('comun:hoy')} ${hora}`;
    if (dia === 'ayer') return `${t('comun:ayer')} ${hora}`;
    return formatearFecha(miembro.ultimoIngresoEn);
  };

  const columnas: Columna<MiembroEquipo>[] = [
    {
      id: 'nombre',
      encabezado: t('equipo:columna.nombre'),
      celda: (m) => (
        <span className={styles.persona}>
          <Avatar nombre={m.nombre} />
          <strong>{m.nombre}</strong>
          {m.esActual ? <span className={styles.yo}>{t('equipo:yo')}</span> : null}
        </span>
      ),
    },
    {
      id: 'usuario',
      encabezado: t('equipo:columna.usuario'),
      celda: (m) => <TextoMono>{m.usuario}</TextoMono>,
    },
    {
      id: 'ingreso',
      encabezado: t('equipo:columna.ultimoIngreso'),
      secundaria: true,
      celda: (m) => <TextoMono>{ultimoIngreso(m)}</TextoMono>,
    },
    {
      id: 'estado',
      encabezado: t('equipo:columna.estado'),
      celda: (m) =>
        m.activo ? (
          <AccesoBadge tono="primario" icono="check_circle">
            {t('equipo:activo')}
          </AccesoBadge>
        ) : (
          <AccesoBadge tono="neutro" icono="block">
            {t('equipo:desactivado')}
          </AccesoBadge>
        ),
    },
    {
      id: 'accion',
      encabezado: t('equipo:columna.accion'),
      alinear: 'fin',
      celda: (m) => (
        <span className={styles.acciones}>
          <BotonIcono
            icono="edit"
            accion="editar"
            etiqueta={t('equipo:editar', { nombre: m.nombre })}
            onClick={() => {
              setAEditar(m);
            }}
          />
          {puedeDesactivar(m) ? (
            <BotonIcono
              icono="block"
              accion="eliminar"
              etiqueta={t('equipo:desactivarA', { nombre: m.nombre })}
              onClick={() => {
                setADesactivar(m);
              }}
            />
          ) : null}
          {puedeReactivar(m) ? (
            <BotonIcono
              icono="refresh"
              accion="ver"
              etiqueta={t('equipo:reactivarA', { nombre: m.nombre })}
              disabled={reactivar.isPending}
              onClick={() => {
                reactivar.mutate(m.id);
              }}
            />
          ) : null}
        </span>
      ),
    },
  ];

  const confirmar = () => {
    if (aDesactivar) {
      desactivar.mutate(aDesactivar.id, {
        onSettled: () => {
          setADesactivar(null);
        },
      });
    }
  };

  return (
    <>
      <EncabezadoPagina
        titulo={t('equipo:titulo')}
        subtitulo={equipo.data ? t('equipo:subtitulo', { count: equipo.data.activos }) : undefined}
        accion={
          <AccesoBoton
            icono="person_add"
            onClick={() => {
              setAgregando(true);
            }}
          >
            {t('equipo:agregar')}
          </AccesoBoton>
        }
      />
      {desactivar.isError || reactivar.isError ? (
        <Aviso tono="peligro">
          {traducirError(t, codigoDe(desactivar.error ?? reactivar.error))}
        </Aviso>
      ) : null}
      <ListadoPaginado
        etiqueta={t('equipo:tabla')}
        columnas={columnas}
        filas={equipo.data?.miembros}
        claveDe={(m) => m.id}
        cargando={equipo.isPending}
        hayError={equipo.isError}
        errorCode={codigoDe(equipo.error)}
        onReintentar={() => void equipo.refetch()}
        tituloError={t('equipo:errorCarga')}
        vacio={{
          titulo: t('equipo:vacio.titulo'),
          texto: t('equipo:vacio.texto'),
          ilustracion: 'vacioPuertas',
        }}
      />
      <p className={styles.nota}>
        <Icono nombre="info" tamano={20} />
        {t('equipo:noAutodesactivar')}
      </p>
      {aEditar ? (
        <DialogoEditarMiembro
          miembro={aEditar}
          onCerrar={() => {
            setAEditar(null);
          }}
        />
      ) : null}
      <DialogoAgregarMiembro
        abierto={agregando}
        onCerrar={() => {
          setAgregando(false);
        }}
      />
      <ConfirmarDialogo
        abierto={aDesactivar !== null}
        titulo={t('equipo:confirmarTitulo', { nombre: aDesactivar?.nombre ?? '' })}
        texto={t('equipo:confirmarTexto')}
        etiquetaConfirmar={desactivar.isPending ? t('equipo:desactivando') : t('equipo:desactivar')}
        cargando={desactivar.isPending}
        peligro
        onConfirmar={confirmar}
        onCancelar={() => {
          setADesactivar(null);
        }}
      />
    </>
  );
}
