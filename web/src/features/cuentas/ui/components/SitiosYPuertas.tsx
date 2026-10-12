import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatearTranscurrido } from '../../../../l10n/formatos';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBadge } from '../../../../shared/ui/atoms/AccesoBadge';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { BotonIcono } from '../../../../shared/ui/atoms/BotonIcono';
import { Icono } from '../../../../shared/ui/atoms/Icono';
import { Skeleton } from '../../../../shared/ui/atoms/Skeleton';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { ConfirmarDialogo } from '../../../../shared/ui/organisms/ConfirmarDialogo';
import { EstadoError } from '../../../../shared/ui/organisms/EstadoError';
import { EstadoVacio } from '../../../../shared/ui/organisms/EstadoVacio';
import { TablaDatos, type Columna } from '../../../../shared/ui/organisms/TablaDatos';
import { tienePermiso, useSesion } from '../../../seguridad';
import { useGestionDeEstructura, useSitiosYPuertas } from '../../application/useCuentas';
import type { PuertaDeSitio, SitioConPuertas } from '../../domain/cuenta';
import { DialogoPuerta } from './DialogoPuerta';
import { DialogoSitio } from './DialogoSitio';
import styles from './SitiosYPuertas.module.css';

/** Qué diálogo está abierto y sobre qué. */
type Dialogo =
  | { tipo: 'sitio'; sitio: SitioConPuertas | null }
  | { tipo: 'puerta'; sitio: SitioConPuertas; puerta: PuertaDeSitio | null }
  | { tipo: 'quitarSitio'; sitio: SitioConPuertas }
  | { tipo: 'quitarPuerta'; puerta: PuertaDeSitio };

/**
 * Pestaña "Sitios y puertas" (A05c): AGROCOM registra los sitios y las puertas de la cuenta; luego
 * el ESP32 se vincula a cada puerta. El administrador de la cuenta ajusta nombres y habilita o
 * deshabilita puertas desde la app. Cada puerta muestra el estado de su lector.
 */
export function SitiosYPuertas({ cuentaId }: { cuentaId: string }) {
  const { t } = useTranslation(['detalle', 'estructura']);
  const sitios = useSitiosYPuertas(cuentaId, true);
  const gestion = useGestionDeEstructura(cuentaId);
  const { sesion } = useSesion();
  const permisos = sesion?.permisos ?? [];
  const puedeSitios = tienePermiso(permisos, 'organizacion.sitio.gestionar');
  const puedePuertas = tienePermiso(permisos, 'organizacion.puerta.gestionar');
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const ahora = new Date();

  const cerrar = () => {
    setDialogo(null);
  };
  const columnasDe = (sitio: SitioConPuertas): Columna<PuertaDeSitio>[] => [
    {
      id: 'puerta',
      encabezado: t('detalle:puertaColumna'),
      celda: (p) => (
        <span className={p.activa ? undefined : styles.apagada}>
          <strong>{p.nombre}</strong>
        </span>
      ),
    },
    {
      id: 'apertura',
      encabezado: t('estructura:aperturaColumna'),
      celda: (p) => (
        <span className={styles.suave}>
          <TextoMono>{t('estructura:segundosValor', { count: p.segundosApertura })}</TextoMono>
        </span>
      ),
    },
    {
      id: 'dispositivo',
      encabezado: t('detalle:dispositivoColumna'),
      celda: (p) => (
        <span className={styles.suave}>
          <TextoMono>{p.dispositivo?.nombre ?? t('detalle:sinLector')}</TextoMono>
        </span>
      ),
    },
    {
      id: 'senal',
      encabezado: t('detalle:senalColumna'),
      celda: (p) => (
        <span className={styles.suave}>
          <TextoMono>
            {p.dispositivo?.ultimaSenal
              ? formatearTranscurrido(p.dispositivo.ultimaSenal, ahora)
              : t('detalle:sinSenal')}
          </TextoMono>
        </span>
      ),
    },
    {
      id: 'estado',
      encabezado: t('detalle:estadoColumna'),
      celda: (p) =>
        !p.activa ? (
          <AccesoBadge tono="neutro" icono="block">
            {t('estructura:desactivada')}
          </AccesoBadge>
        ) : p.dispositivo === null ? null : p.dispositivo.enLinea ? (
          <AccesoBadge tono="primario" icono="wifi">
            {t('detalle:enLinea')}
          </AccesoBadge>
        ) : (
          <AccesoBadge tono="peligro" icono="wifi_off">
            {t('detalle:sinConexion')}
          </AccesoBadge>
        ),
    },
    ...(puedePuertas
      ? [
          {
            id: 'acciones',
            encabezado: t('estructura:acciones'),
            alinear: 'fin' as const,
            celda: (p: PuertaDeSitio) => (
              <span className={styles.botones}>
                <BotonIcono
                  icono="edit"
                  accion="editar"
                  etiqueta={t('estructura:editarPuerta', { puerta: p.nombre })}
                  onClick={() => {
                    setDialogo({ tipo: 'puerta', sitio, puerta: p });
                  }}
                />
                <BotonIcono
                  icono="delete"
                  accion="eliminar"
                  etiqueta={t('estructura:quitarPuerta', { puerta: p.nombre })}
                  onClick={() => {
                    setDialogo({ tipo: 'quitarPuerta', puerta: p });
                  }}
                />
              </span>
            ),
          },
        ]
      : []),
  ];

  const errorDeBaja = gestion.eliminarSitio.isError
    ? gestion.eliminarSitio.error
    : gestion.eliminarPuerta.isError
      ? gestion.eliminarPuerta.error
      : null;

  return (
    <div className={styles.contenedor}>
      <div className={styles.cabecera}>
        <p className={styles.nota}>
          <Icono nombre="info" tamano={20} />
          {t('estructura:nota')}
        </p>
        {puedeSitios ? (
          <AccesoBoton
            icono="add_business"
            onClick={() => {
              setDialogo({ tipo: 'sitio', sitio: null });
            }}
          >
            {t('estructura:sitioNuevo')}
          </AccesoBoton>
        ) : null}
      </div>
      {errorDeBaja ? <Aviso tono="peligro">{traducirError(t, codigoDe(errorDeBaja))}</Aviso> : null}
      {sitios.isError ? (
        <EstadoError
          titulo={t('detalle:errorCarga')}
          code={codigoDe(sitios.error)}
          onReintentar={() => void sitios.refetch()}
        />
      ) : sitios.isPending ? (
        <div aria-busy="true">
          <Skeleton alto="bloque" />
        </div>
      ) : sitios.data.length === 0 ? (
        <EstadoVacio
          titulo={t('detalle:sitiosVacio.titulo')}
          texto={t('estructura:vacioTexto')}
          accion={
            puedeSitios ? (
              <AccesoBoton
                icono="add_business"
                onClick={() => {
                  setDialogo({ tipo: 'sitio', sitio: null });
                }}
              >
                {t('estructura:sitioNuevo')}
              </AccesoBoton>
            ) : undefined
          }
        />
      ) : (
        sitios.data.map((sitio) => (
          <section key={sitio.id} className={styles.sitio} aria-labelledby={`sitio-${sitio.id}`}>
            <div className={styles.encabezadoSitio}>
              <div>
                <h2 id={`sitio-${sitio.id}`} className={styles.nombre}>
                  <Icono nombre="location_on" />
                  {sitio.nombre}
                  {sitio.activo ? null : (
                    <AccesoBadge tono="neutro" icono="block">
                      {t('estructura:desactivado')}
                    </AccesoBadge>
                  )}
                </h2>
                <p className={styles.detalleSitio}>
                  {[sitio.direccion, sitio.zonaHoraria].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className={styles.botones}>
                {puedePuertas ? (
                  <AccesoBoton
                    variante="tonal"
                    icono="add"
                    onClick={() => {
                      setDialogo({ tipo: 'puerta', sitio, puerta: null });
                    }}
                  >
                    {t('estructura:puertaAgregar')}
                  </AccesoBoton>
                ) : null}
                {puedeSitios ? (
                  <>
                    <BotonIcono
                      icono="edit"
                      accion="editar"
                      etiqueta={t('estructura:editarSitio', { sitio: sitio.nombre })}
                      onClick={() => {
                        setDialogo({ tipo: 'sitio', sitio });
                      }}
                    />
                    <BotonIcono
                      icono="delete"
                      accion="eliminar"
                      etiqueta={t('estructura:quitarSitio', { sitio: sitio.nombre })}
                      onClick={() => {
                        setDialogo({ tipo: 'quitarSitio', sitio });
                      }}
                    />
                  </>
                ) : null}
              </div>
            </div>
            {sitio.puertas.length === 0 ? (
              <p className={styles.sinPuertas}>{t('estructura:sinPuertas')}</p>
            ) : (
              <TablaDatos
                incrustada
                etiqueta={sitio.nombre}
                columnas={columnasDe(sitio)}
                filas={sitio.puertas}
                claveDe={(p) => p.id}
              />
            )}
          </section>
        ))
      )}

      {dialogo?.tipo === 'sitio' ? (
        <DialogoSitio
          key={dialogo.sitio?.id ?? 'nuevo'}
          abierto
          onCerrar={cerrar}
          cuentaId={cuentaId}
          sitio={dialogo.sitio}
        />
      ) : null}
      {dialogo?.tipo === 'puerta' ? (
        <DialogoPuerta
          key={dialogo.puerta?.id ?? `nueva-${dialogo.sitio.id}`}
          abierto
          onCerrar={cerrar}
          cuentaId={cuentaId}
          sitio={dialogo.sitio}
          puerta={dialogo.puerta}
        />
      ) : null}
      <ConfirmarDialogo
        abierto={dialogo?.tipo === 'quitarSitio'}
        peligro
        titulo={t('estructura:quitarSitioTitulo', {
          sitio: dialogo?.tipo === 'quitarSitio' ? dialogo.sitio.nombre : '',
        })}
        texto={t('estructura:quitarSitioTexto')}
        etiquetaConfirmar={
          gestion.eliminarSitio.isPending ? t('estructura:quitando') : t('estructura:quitar')
        }
        cargando={gestion.eliminarSitio.isPending}
        onCancelar={cerrar}
        onConfirmar={() => {
          if (dialogo?.tipo === 'quitarSitio') {
            gestion.eliminarSitio.mutate(dialogo.sitio.id, { onSettled: cerrar });
          }
        }}
      />
      <ConfirmarDialogo
        abierto={dialogo?.tipo === 'quitarPuerta'}
        peligro
        titulo={t('estructura:quitarPuertaTitulo', {
          puerta: dialogo?.tipo === 'quitarPuerta' ? dialogo.puerta.nombre : '',
        })}
        texto={t('estructura:quitarPuertaTexto')}
        etiquetaConfirmar={
          gestion.eliminarPuerta.isPending ? t('estructura:quitando') : t('estructura:quitar')
        }
        cargando={gestion.eliminarPuerta.isPending}
        onCancelar={cerrar}
        onConfirmar={() => {
          if (dialogo?.tipo === 'quitarPuerta') {
            gestion.eliminarPuerta.mutate(dialogo.puerta.id, { onSettled: cerrar });
          }
        }}
      />
    </div>
  );
}
