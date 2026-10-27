import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatearFecha, formatearHora } from '../../../../l10n/formatos';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { BotonIcono } from '../../../../shared/ui/atoms/BotonIcono';
import { Skeleton } from '../../../../shared/ui/atoms/Skeleton';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { ConfirmarDialogo } from '../../../../shared/ui/organisms/ConfirmarDialogo';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import { EstadoError } from '../../../../shared/ui/organisms/EstadoError';
import { EstadoVacio } from '../../../../shared/ui/organisms/EstadoVacio';
import { TablaDatos, type Columna } from '../../../../shared/ui/organisms/TablaDatos';
import { PERMISO_CERRAR_SESIONES } from '../../domain/sesion';
import { tienePermiso, useSesion } from '../../../seguridad';
import {
  useCerrarSesion,
  useCerrarTodasLasSesiones,
  useSesionesDeUsuario,
} from '../../application/useSesiones';
import type { SesionDeUsuario, UsuarioConSesiones } from '../../domain/sesion';
import styles from './DialogoSesionesDeUsuario.module.css';

interface Props {
  cuentaId: string;
  usuario: UsuarioConSesiones;
  onCerrar: () => void;
}

/** Lo que el diálogo pide confirmar antes de cerrar: una sesión, o todas (con los QR vigentes). */
type Confirmacion = { tipo: 'una'; sesion: SesionDeUsuario } | { tipo: 'todas' } | null;

/** Fecha y hora en la zona de La Paz, como el resto del panel. */
function cuandoDe(fecha: Date): string {
  return `${formatearFecha(fecha)} ${formatearHora(fecha)}`;
}

/**
 * Los dispositivos conectados de un usuario (ADR 0030 §4.1). Solo se ven y se cierran: iniciar sesión
 * en varios aparatos es normal. Cerrar todas anula además sus QR vigentes (la API lo hace).
 * El nombre del dispositivo lo manda el cliente y se muestra como texto plano, nunca como HTML.
 */
export function DialogoSesionesDeUsuario({ cuentaId, usuario, onCerrar }: Props) {
  const { t } = useTranslation(['sesiones', 'comun', 'errores']);
  const { sesion } = useSesion();
  const puedeCerrar = tienePermiso(sesion?.permisos ?? [], PERMISO_CERRAR_SESIONES);
  const consulta = useSesionesDeUsuario(cuentaId, usuario.id);
  const cerrarUna = useCerrarSesion(cuentaId, usuario.id);
  const cerrarTodas = useCerrarTodasLasSesiones(cuentaId, usuario.id);
  const [confirmando, setConfirmando] = useState<Confirmacion>(null);

  const nombre = usuario.etiqueta ?? t('sesiones:sinNombre');
  const sesiones = consulta.data ?? [];
  const errorDeAccion = cerrarUna.error ?? cerrarTodas.error;

  const columnas: Columna<SesionDeUsuario>[] = [
    {
      id: 'dispositivo',
      encabezado: t('sesiones:columnas.dispositivo'),
      celda: (fila) => (
        <span className={styles.dispositivo}>
          {/* Texto plano: React lo escapa; nunca se interpreta como HTML. */}
          <strong>{fila.dispositivo ?? t('sesiones:dispositivo.sinNombre')}</strong>
          <span className={styles.suave}>
            {fila.plataforma === null
              ? t('sesiones:plataforma.desconocida')
              : t(`sesiones:plataforma.${fila.plataforma}`)}
          </span>
        </span>
      ),
    },
    {
      id: 'ip',
      encabezado: t('sesiones:columnas.ip'),
      secundaria: true,
      celda: (fila) => (fila.ip === null ? t('comun:sinDato') : <TextoMono>{fila.ip}</TextoMono>),
    },
    {
      id: 'inicio',
      encabezado: t('sesiones:columnas.inicio'),
      secundaria: true,
      celda: (fila) => <TextoMono>{cuandoDe(fila.iniciadaEn)}</TextoMono>,
    },
    {
      id: 'actividad',
      encabezado: t('sesiones:columnas.actividad'),
      celda: (fila) => <TextoMono>{cuandoDe(fila.ultimaActividadEn)}</TextoMono>,
    },
  ];
  if (puedeCerrar) {
    columnas.push({
      id: 'acciones',
      encabezado: '',
      alinear: 'fin',
      celda: (fila) => (
        <BotonIcono
          icono="logout"
          accion="eliminar"
          etiqueta={t('sesiones:cerrarUna', {
            dispositivo: fila.dispositivo ?? t('sesiones:dispositivo.sinNombre'),
          })}
          onClick={() => {
            setConfirmando({ tipo: 'una', sesion: fila });
          }}
        />
      ),
    });
  }

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
          titulo={t('sesiones:errorCarga')}
          code={codigoDe(consulta.error)}
          onReintentar={() => void consulta.refetch()}
        />
      );
    }
    if (sesiones.length === 0) {
      return (
        <EstadoVacio
          ilustracion="vacioPuertas"
          titulo={t('sesiones:vacio.titulo')}
          texto={t('sesiones:vacio.texto')}
        />
      );
    }
    return (
      <TablaDatos
        columnas={columnas}
        filas={sesiones}
        claveDe={(fila) => fila.id}
        etiqueta={t('sesiones:tabla', { usuario: nombre })}
      />
    );
  };

  return (
    <>
      <Dialogo
        abierto
        titulo={t('sesiones:titulo')}
        onCerrar={onCerrar}
        ancho="amplio"
        acciones={
          puedeCerrar && sesiones.length > 0 ? (
            <AccesoBoton
              variante="peligro"
              icono="block"
              cargando={cerrarTodas.isPending}
              onClick={() => {
                setConfirmando({ tipo: 'todas' });
              }}
            >
              {t('sesiones:cerrarTodas')}
            </AccesoBoton>
          ) : undefined
        }
      >
        <p className={styles.subtitulo}>{t('sesiones:subtitulo', { usuario: nombre })}</p>
        {cerrarTodas.isSuccess ? (
          <Aviso tono="informacion">{t('sesiones:cerradas', { count: cerrarTodas.data })}</Aviso>
        ) : null}
        {errorDeAccion ? (
          <Aviso tono="peligro">{traducirError(t, codigoDe(errorDeAccion))}</Aviso>
        ) : null}
        <div className={styles.contenido}>{contenido()}</div>
      </Dialogo>
      <ConfirmarDialogo
        abierto={confirmando !== null}
        peligro
        titulo={
          confirmando?.tipo === 'todas'
            ? t('sesiones:confirmarTodas.titulo')
            : t('sesiones:confirmarUna.titulo')
        }
        texto={
          confirmando?.tipo === 'todas'
            ? t('sesiones:confirmarTodas.texto', { usuario: nombre })
            : t('sesiones:confirmarUna.texto')
        }
        etiquetaConfirmar={
          confirmando?.tipo === 'todas'
            ? t('sesiones:confirmarTodas.accion')
            : t('sesiones:confirmarUna.accion')
        }
        cargando={cerrarUna.isPending || cerrarTodas.isPending}
        onCancelar={() => {
          setConfirmando(null);
        }}
        onConfirmar={() => {
          const elegida = confirmando;
          setConfirmando(null);
          if (elegida?.tipo === 'todas') {
            cerrarTodas.mutate();
          } else if (elegida?.tipo === 'una') {
            cerrarUna.mutate(elegida.sesion.id);
          }
        }}
      />
    </>
  );
}
