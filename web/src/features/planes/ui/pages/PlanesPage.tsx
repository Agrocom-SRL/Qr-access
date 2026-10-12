import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatearNumero } from '../../../../l10n/formatos';
import { traducirError } from '../../../../l10n/traducirError';
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
import { useGuardarPrecios, usePlanes, useRetirarPlan } from '../../application/usePlanes';
import { cambiosDePrecio, type Plan } from '../../domain/plan';
import { DialogoPlan } from '../components/DialogoPlan';
import { CampoPrecio } from '../components/CampoPrecio';
import styles from './PlanesPage.module.css';

/** A09: los planes por cupo con su precio anual editable; "Guardar precios" los guarda todos o ninguno. */
export function PlanesPage() {
  const { t } = useTranslation(['planes', 'comun']);
  const planes = usePlanes();
  const guardar = useGuardarPrecios();
  const retirar = useRetirarPlan();
  const { sesion } = useSesion();
  const permisos = sesion?.permisos ?? [];
  const [dialogo, setDialogo] = useState<{ plan: Plan | null } | null>(null);
  const [aRetirar, setARetirar] = useState<Plan | null>(null);
  const [borrador, setBorrador] = useState<Record<string, number>>({});
  const [invalidos, setInvalidos] = useState<ReadonlySet<string>>(new Set());
  const lista = planes.data ?? [];
  const cambios = cambiosDePrecio(lista, borrador);

  const descartar = () => {
    setBorrador({});
    setInvalidos(new Set());
    guardar.reset();
  };
  const enviar = () => {
    guardar.mutate(cambios, {
      onSuccess: () => {
        setBorrador({});
      },
    });
  };

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
        <>
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
                <CampoPrecio
                  id={`precio-${plan.id}`}
                  etiqueta={t('planes:precioAnual')}
                  etiquetaAccesible={t('planes:editarPrecio', { plan: plan.nombre })}
                  valor={borrador[plan.id] ?? plan.precioAnual}
                  deshabilitado={guardar.isPending}
                  onValidez={(valido) => {
                    setInvalidos((actual) => {
                      const siguiente = new Set(actual);
                      if (valido) siguiente.delete(plan.id);
                      else siguiente.add(plan.id);
                      return siguiente;
                    });
                  }}
                  onCambio={(valor) => {
                    setBorrador((actual) => ({ ...actual, [plan.id]: valor }));
                  }}
                />
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
          {guardar.isError ? (
            <Aviso tono="peligro">{traducirError(t, codigoDe(guardar.error))}</Aviso>
          ) : null}
          <div className={styles.acciones}>
            {guardar.isSuccess && cambios.length === 0 ? (
              <span role="status">{t('planes:guardado')}</span>
            ) : null}
            <AccesoBoton
              variante="texto"
              disabled={cambios.length === 0 || guardar.isPending}
              onClick={descartar}
            >
              {t('planes:descartar')}
            </AccesoBoton>
            <AccesoBoton
              cargando={guardar.isPending}
              disabled={cambios.length === 0 || invalidos.size > 0}
              onClick={enviar}
            >
              {guardar.isPending ? t('planes:guardando') : t('planes:guardar')}
            </AccesoBoton>
          </div>
        </>
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
