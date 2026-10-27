import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { Skeleton } from '../../../../shared/ui/atoms/Skeleton';
import { EstadoError } from '../../../../shared/ui/organisms/EstadoError';
import { tienePermiso, useSesion } from '../../../seguridad';
import {
  DialogoSesionesDeUsuario,
  PERMISO_VER_SESIONES,
  type UsuarioConSesiones,
} from '../../../sesiones';
import { useJerarquia } from '../../application/useCuentas';
import { destinosDeReasignacion } from '../../domain/cuenta';
import { DialogoReasignar, type Reasignable } from './DialogoReasignar';
import styles from './JerarquiaDeCuenta.module.css';

/**
 * Cómo está armada la cuenta (ADR 0028 §6): cada Administrador con sus Guardias y sus Titulares
 * (unidad y cuántos Miembros tiene cada uno). Con el permiso de reasignar, un Guardia o un Titular
 * se puede mover a otro Administrador; es la única forma de hacerlo. Con el permiso de sesiones, cada
 * persona abre sus dispositivos conectados (ADR 0030 §4.1).
 */
export function JerarquiaDeCuenta({
  cuentaId,
  puedeReasignar,
}: {
  cuentaId: string;
  /** Permiso `seguridad.administrador.reasignar`; la autoridad es la API. */
  puedeReasignar: boolean;
}) {
  const { t } = useTranslation(['detalle', 'comun']);
  const arbol = useJerarquia(cuentaId);
  const { sesion } = useSesion();
  const puedeVerSesiones = tienePermiso(sesion?.permisos ?? [], PERMISO_VER_SESIONES);
  const [aMover, setAMover] = useState<Reasignable | null>(null);
  const [conSesiones, setConSesiones] = useState<UsuarioConSesiones | null>(null);

  const botonDeSesiones = (usuario: UsuarioConSesiones) =>
    puedeVerSesiones ? (
      <AccesoBoton
        variante="tonal"
        icono="wifi"
        aria-label={t('detalle:verSesiones', { nombre: usuario.etiqueta ?? '' })}
        onClick={() => {
          setConSesiones(usuario);
        }}
      >
        {t('detalle:dispositivos')}
      </AccesoBoton>
    ) : null;

  return (
    <section className={styles.tarjeta} aria-labelledby="jerarquia-titulo">
      <h2 id="jerarquia-titulo" className={styles.titulo}>
        {t('detalle:jerarquiaTitulo')}
      </h2>
      {arbol.isError ? (
        <EstadoError
          titulo={t('detalle:errorJerarquia')}
          code={codigoDe(arbol.error)}
          onReintentar={() => void arbol.refetch()}
        />
      ) : arbol.isPending ? (
        <Skeleton alto="bloque" />
      ) : arbol.data.length === 0 ? (
        <p className={styles.suave}>{t('detalle:administradoresVacio')}</p>
      ) : (
        <ul className={styles.ramas}>
          {arbol.data.map((rama) => (
            <li key={rama.id} className={styles.rama}>
              <div className={styles.cabeceraRama}>
                <h3 className={styles.administrador}>{rama.etiqueta}</h3>
                {botonDeSesiones({ id: rama.id, etiqueta: rama.etiqueta })}
              </div>
              {rama.guardias.length === 0 && rama.titulares.length === 0 ? (
                <p className={styles.suave}>{t('detalle:ramaVacia')}</p>
              ) : (
                <ul className={styles.nivel}>
                  {rama.titulares.map((titular) => (
                    <li key={titular.id} className={styles.fila}>
                      <div className={styles.datos}>
                        <strong>{titular.etiqueta}</strong>
                        <span className={styles.suave}>
                          {t('detalle:titularDetalle', {
                            unidad: titular.unidad ?? t('detalle:sinUnidad'),
                            count: titular.miembros,
                          })}
                        </span>
                      </div>
                      {botonDeSesiones({ id: titular.id, etiqueta: titular.etiqueta })}
                      {puedeReasignar ? (
                        <AccesoBoton
                          variante="tonal"
                          icono="swap_vert"
                          aria-label={t('detalle:reasignarA', { nombre: titular.etiqueta })}
                          onClick={() => {
                            setAMover({
                              id: titular.id,
                              etiqueta: titular.etiqueta,
                              tipo: 'titular',
                              miembros: titular.miembros,
                              administradorId: rama.id,
                            });
                          }}
                        >
                          {t('detalle:reasignar')}
                        </AccesoBoton>
                      ) : null}
                    </li>
                  ))}
                  {rama.guardias.map((guardia) => (
                    <li key={guardia.id} className={styles.fila}>
                      <div className={styles.datos}>
                        <strong>{guardia.etiqueta}</strong>
                        <span className={styles.suave}>{t('detalle:guardiaDetalle')}</span>
                      </div>
                      {botonDeSesiones({ id: guardia.id, etiqueta: guardia.etiqueta })}
                      {puedeReasignar ? (
                        <AccesoBoton
                          variante="tonal"
                          icono="swap_vert"
                          aria-label={t('detalle:reasignarA', { nombre: guardia.etiqueta })}
                          onClick={() => {
                            setAMover({
                              id: guardia.id,
                              etiqueta: guardia.etiqueta,
                              tipo: 'guardia',
                              miembros: 0,
                              administradorId: rama.id,
                            });
                          }}
                        >
                          {t('detalle:reasignar')}
                        </AccesoBoton>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      <DialogoReasignar
        cuentaId={cuentaId}
        aMover={aMover}
        destinos={destinosDeReasignacion(arbol.data ?? [], aMover?.administradorId ?? '')}
        onCerrar={() => {
          setAMover(null);
        }}
      />
      {conSesiones ? (
        <DialogoSesionesDeUsuario
          cuentaId={cuentaId}
          usuario={conSesiones}
          onCerrar={() => {
            setConSesiones(null);
          }}
        />
      ) : null}
    </section>
  );
}
