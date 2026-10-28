import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatearFecha, formatearHora } from '../../../../l10n/formatos';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBadge } from '../../../../shared/ui/atoms/AccesoBadge';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { AccesoCampoTexto } from '../../../../shared/ui/molecules/AccesoCampoTexto';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import { tienePermiso, useSesion } from '../../../seguridad';
import { useResolverIncidenteDeCuenta } from '../../application/useIncidentes';
import {
  MAX_MOTIVO_DE_RESOLUCION,
  PERMISO_RESOLVER_INCIDENTE_DE_CUENTA,
  TONO_DE_ESTADO,
  TONO_DE_GRAVEDAD,
  exigeMotivo,
  motivoAEnviar,
  type Incidente,
  type ResultadoDeResolucion,
} from '../../domain/incidente';
import { lineasDeReincidencia } from '../lineasDeResolucion';
import styles from './DialogoDetalleIncidente.module.css';

interface Props {
  cuentaId: string;
  incidente: Incidente;
  onCerrar: () => void;
}

function cuandoDe(fecha: Date): string {
  return `${formatearFecha(fecha)} ${formatearHora(fecha)}`;
}

/**
 * El detalle de un incidente: quién, qué, cuándo, la evidencia en cifras y la resolución si la hay. Quien tiene
 * el permiso de resolver lo confirma, lo descarta o lo deja pendiente; el resto solo lo consulta. El texto libre
 * (descripción, motivos, nombres) se muestra como texto plano, nunca como HTML.
 */
export function DialogoDetalleIncidente({ cuentaId, incidente, onCerrar }: Props) {
  const { t } = useTranslation(['incidentes', 'comun', 'errores', 'notificaciones']);
  const { sesion } = useSesion();
  const puedeResolver = tienePermiso(sesion?.permisos ?? [], PERMISO_RESOLVER_INCIDENTE_DE_CUENTA);
  const resolver = useResolverIncidenteDeCuenta(cuentaId);
  const [motivo, setMotivo] = useState('');
  const [errorMotivo, setErrorMotivo] = useState<string | undefined>(undefined);

  // Tras resolver se muestra lo que devolvió la API (estado y resolución nuevos), no la foto de la lista.
  const respuesta = resolver.data;
  const actual = respuesta?.incidente ?? incidente;
  const reincidencia = respuesta?.reincidencia ?? null;
  const usuario = actual.usuario.etiqueta ?? t('incidentes:sinUsuario');
  // En una propuesta, sin nombre se dice «este usuario», como en los avisos (no «Usuario sin nombre»).
  const usuarioDePropuesta = actual.usuario.etiqueta ?? t('notificaciones:propuesta.sinNombre');
  const evidencia = actual.evidencia;

  const resolverCon = (resultado: ResultadoDeResolucion) => {
    const motivoEnviado = motivoAEnviar(motivo);
    // Confirmar sin motivo se rechaza aquí, antes de llamar a la API (la API también lo rechaza: 422).
    if (exigeMotivo(resultado) && motivoEnviado === undefined) {
      setErrorMotivo(t('incidentes:resolucion.motivoRequerido'));
      return;
    }
    setErrorMotivo(undefined);
    resolver.mutate({ incidenteId: actual.id, resultado, motivo: motivoEnviado });
  };

  const cargandoEn = (resultado: ResultadoDeResolucion) =>
    resolver.isPending && resolver.variables.resultado === resultado;

  const acciones = puedeResolver ? (
    <>
      <AccesoBoton
        variante="advertencia"
        icono="pending_actions"
        disabled={resolver.isPending && !cargandoEn('pendiente')}
        cargando={cargandoEn('pendiente')}
        onClick={() => {
          resolverCon('pendiente');
        }}
      >
        {t('incidentes:resolucion.pendiente')}
      </AccesoBoton>
      <AccesoBoton
        variante="primario"
        icono="do_not_disturb_on"
        disabled={resolver.isPending && !cargandoEn('descartado')}
        cargando={cargandoEn('descartado')}
        onClick={() => {
          resolverCon('descartado');
        }}
      >
        {t('incidentes:resolucion.descartar')}
      </AccesoBoton>
      <AccesoBoton
        variante="peligro"
        icono="check"
        disabled={resolver.isPending && !cargandoEn('confirmado')}
        cargando={cargandoEn('confirmado')}
        onClick={() => {
          resolverCon('confirmado');
        }}
      >
        {t('incidentes:resolucion.confirmar')}
      </AccesoBoton>
    </>
  ) : undefined;

  return (
    <Dialogo
      abierto
      titulo={t('incidentes:detalle.titulo', { usuario })}
      onCerrar={onCerrar}
      ancho="ancho"
      acciones={acciones}
    >
      {puedeResolver ? null : <p className={styles.aviso}>{t('incidentes:detalle.soloLectura')}</p>}
      <div className={styles.insignias}>
        <AccesoBadge tono={TONO_DE_GRAVEDAD[actual.gravedad]}>
          {t(`incidentes:gravedad.${actual.gravedad}`)}
        </AccesoBadge>
        <AccesoBadge tono={TONO_DE_ESTADO[actual.estado]}>
          {t(`incidentes:estado.${actual.estado}`)}
        </AccesoBadge>
      </div>
      <dl className={styles.datos}>
        <dt>{t('incidentes:detalle.usuario')}</dt>
        <dd>{usuario}</dd>
        <dt>{t('incidentes:detalle.tipo')}</dt>
        <dd>{t(`incidentes:tipo.${actual.tipo}`)}</dd>
        <dt>{t('incidentes:detalle.origen')}</dt>
        <dd>
          {t(`incidentes:origen.${actual.origen}`)}
          {actual.registradoPor ? (
            <span className={styles.suave}>
              {' · '}
              {t('incidentes:detalle.registradoPor', {
                persona: actual.registradoPor.etiqueta ?? t('incidentes:sinUsuario'),
              })}
            </span>
          ) : null}
        </dd>
        <dt>{t('incidentes:detalle.ocurrido')}</dt>
        <dd>
          <TextoMono>{cuandoDe(actual.ocurridoEn)}</TextoMono>
        </dd>
        <dt>{t('incidentes:detalle.descripcion')}</dt>
        {/* Texto plano: lo escribió una persona o el sistema, y se muestra tal cual, nunca como HTML. */}
        <dd>{actual.descripcion ?? t('incidentes:detalle.sinDescripcion')}</dd>
        <dt>{t('incidentes:detalle.evidencia')}</dt>
        <dd>
          {t('incidentes:detalle.evidenciaCifras', {
            qr: evidencia.qrIds.length,
            accesos: evidencia.eventoAccesoIds.length,
            limites: evidencia.eventoLimiteIds.length,
          })}
        </dd>
        <dt>{t('incidentes:detalle.resolucion')}</dt>
        <dd>
          {actual.resolucion === null ? (
            t('incidentes:detalle.sinResolver')
          ) : (
            <span className={styles.resolucion}>
              <strong>{t(`incidentes:estado.${actual.resolucion.resultado}`)}</strong>
              <span className={styles.suave}>
                {t('incidentes:detalle.resueltoPor', {
                  persona: actual.resolucion.resueltoPor.etiqueta ?? t('incidentes:sinUsuario'),
                  cuando: cuandoDe(actual.resolucion.resueltaEn),
                })}
              </span>
              <span>{actual.resolucion.motivo ?? t('incidentes:detalle.sinMotivo')}</span>
            </span>
          )}
        </dd>
      </dl>
      {puedeResolver ? (
        <AccesoCampoTexto
          etiqueta={t('incidentes:resolucion.motivo')}
          ayuda={t('incidentes:resolucion.motivoAyuda')}
          error={errorMotivo}
          value={motivo}
          maxLength={MAX_MOTIVO_DE_RESOLUCION}
          onChange={(evento) => {
            setMotivo(evento.target.value);
            setErrorMotivo(undefined);
          }}
        />
      ) : null}
      {resolver.isError ? (
        <Aviso tono="peligro">{traducirError(t, codigoDe(resolver.error))}</Aviso>
      ) : null}
      {resolver.isSuccess ? (
        <Aviso tono="exito">
          {t('incidentes:resolucion.guardado', {
            estado: t(`incidentes:estado.${actual.estado}`),
          })}
        </Aviso>
      ) : null}
      {reincidencia ? (
        <Aviso tono={reincidencia.propuesta === null ? 'informacion' : 'advertencia'}>
          {lineasDeReincidencia(t, reincidencia, usuarioDePropuesta).map((linea) => (
            <p key={linea} className={styles.linea}>
              {linea}
            </p>
          ))}
        </Aviso>
      ) : null}
    </Dialogo>
  );
}
