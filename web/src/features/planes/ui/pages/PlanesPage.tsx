import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatearNumero } from '../../../../l10n/formatos';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { BotonIcono } from '../../../../shared/ui/atoms/BotonIcono';
import { Icono } from '../../../../shared/ui/atoms/Icono';
import { Skeleton } from '../../../../shared/ui/atoms/Skeleton';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { EncabezadoPagina } from '../../../../shared/ui/molecules/EncabezadoPagina';
import { ConfirmarDialogo } from '../../../../shared/ui/organisms/ConfirmarDialogo';
import { EstadoError } from '../../../../shared/ui/organisms/EstadoError';
import { EstadoVacio } from '../../../../shared/ui/organisms/EstadoVacio';
import { TarjetaPlan } from '../../../../shared/ui/organisms/TarjetaPlan';
import { tienePermiso, useSesion } from '../../../seguridad';
import { usePlanes, useRetirarPlan } from '../../application/usePlanes';
import type { Plan } from '../../domain/plan';
import { DialogoPlan } from '../components/DialogoPlan';
import styles from './PlanesPage.module.css';

/** A09: los planes por cupo con su precio anual; el precio se cambia desde el diálogo de editar. */
export function PlanesPage() {
  const { t } = useTranslation(['planes', 'comun']);
  const planes = usePlanes();
  const retirar = useRetirarPlan();
  const { sesion } = useSesion();
  const permisos = sesion?.permisos ?? [];
  const [dialogo, setDialogo] = useState<{ plan: Plan | null } | null>(null);
  const [aRetirar, setARetirar] = useState<Plan | null>(null);
  const lista = planes.data ?? [];

  return (
    <>
      <EncabezadoPagina
        titulo={t('planes:titulo')}
        subtitulo={t('planes:subtitulo')}
        accion={
          tienePermiso(permisos, 'suscripciones.plan.crear') ? (
            <AccesoBoton
              icono="add"
              onClick={() => {
                setDialogo({ plan: null });
              }}
            >
              {t('planes:nuevo')}
            </AccesoBoton>
          ) : undefined
        }
      />
      <Aviso tono="informacion">{t('planes:aviso')}</Aviso>

      {planes.isError ? (
        <EstadoError
          titulo={t('planes:errorCarga')}
          code={codigoDe(planes.error)}
          onReintentar={() => void planes.refetch()}
        />
      ) : planes.isPending ? (
        <div className={styles.rejilla} aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} alto="bloque" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <EstadoVacio titulo={t('planes:vacio.titulo')} texto={t('planes:vacio.texto')} />
      ) : (
        <div className={styles.rejilla}>
          {lista.map((plan) => (
            <TarjetaPlan
              key={plan.id}
              etiquetaCupo={t('planes:hasta')}
              cupo={t('planes:usuarios', { count: plan.cupoUsuarios ?? 0 })}
              pie={
                <>
                  <div>
                    <p className={styles.pequeno}>{t('planes:cuentas')}</p>
                    <TextoMono fuerte>{formatearNumero(plan.cuentas)}</TextoMono>
                  </div>
                  <div>
                    <p className={styles.pequeno}>{t('planes:usuariosEnUso')}</p>
                    <TextoMono fuerte>{formatearNumero(plan.usuariosEnUso)}</TextoMono>
                  </div>
                  <div className={styles.esquina}>
                    {tienePermiso(permisos, 'suscripciones.plan.editar') ? (
                      <BotonIcono
                        icono="edit"
                        accion="editar"
                        etiqueta={t('planes:editarPlan', { plan: plan.nombre })}
                        onClick={() => {
                          setDialogo({ plan });
                        }}
                      />
                    ) : null}
                    {tienePermiso(permisos, 'suscripciones.plan.eliminar') ? (
                      <BotonIcono
                        icono="block"
                        accion="eliminar"
                        etiqueta={t('planes:retirarPlan', { plan: plan.nombre })}
                        onClick={() => {
                          setARetirar(plan);
                        }}
                      />
                    ) : null}
                  </div>
                </>
              }
            >
              <div>
                <p className={styles.pequeno}>{t('planes:precioAnual')}</p>
                <p className={styles.precio}>
                  <span>{t('planes:moneda')}</span>
                  <TextoMono fuerte>{formatearNumero(plan.precioAnual)}</TextoMono>
                </p>
              </div>
              <div className={styles.fijo}>
                <span className={styles.qr}>
                  <Icono nombre="all_inclusive" />
                  {t('planes:qrIlimitados')}
                </span>
                <span className={styles.candado}>
                  <Icono nombre="lock" tamano={16} />
                  {t('planes:fijo')}
                </span>
              </div>
            </TarjetaPlan>
          ))}
        </div>
      )}

      <DialogoPlan
        abierto={dialogo !== null}
        plan={dialogo?.plan ?? null}
        onCerrar={() => {
          setDialogo(null);
        }}
      />
      <ConfirmarDialogo
        abierto={aRetirar !== null}
        peligro
        titulo={t('planes:retirarTitulo', { plan: aRetirar?.nombre ?? '' })}
        texto={
          aRetirar && aRetirar.cuentas > 0
            ? t('planes:retirarTextoConCuentas', { count: aRetirar.cuentas })
            : t('planes:retirarTextoSinCuentas')
        }
        etiquetaConfirmar={retirar.isPending ? t('planes:retirando') : t('planes:retirar')}
        cargando={retirar.isPending}
        onCancelar={() => {
          setARetirar(null);
        }}
        onConfirmar={() => {
          if (aRetirar) {
            retirar.mutate(aRetirar.id, {
              onSettled: () => {
                setARetirar(null);
              },
            });
          }
        }}
      />
    </>
  );
}
