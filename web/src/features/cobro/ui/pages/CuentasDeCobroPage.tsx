import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { AccesoInterruptor } from '../../../../shared/ui/atoms/AccesoInterruptor';
import { BotonIcono } from '../../../../shared/ui/atoms/BotonIcono';
import { Skeleton } from '../../../../shared/ui/atoms/Skeleton';
import { EncabezadoPagina } from '../../../../shared/ui/molecules/EncabezadoPagina';
import { ConfirmarDialogo } from '../../../../shared/ui/organisms/ConfirmarDialogo';
import { EstadoError } from '../../../../shared/ui/organisms/EstadoError';
import { EstadoVacio } from '../../../../shared/ui/organisms/EstadoVacio';
import { tienePermiso, useSesion } from '../../../seguridad';
import {
  useCambiarActivoDeCuentaDeCobro,
  useCuentasDeCobro,
  useEliminarCuentaDeCobro,
} from '../../application/useCobro';
import type { CuentaDeCobro } from '../../domain/cuentaDeCobro';
import { DialogoCuentaDeCobro } from '../components/DialogoCuentaDeCobro';
import { TarjetaCuentaDeCobro } from '../components/TarjetaCuentaDeCobro';
import styles from './CuentasDeCobroPage.module.css';

/** Dónde recibe AGROCOM los pagos: las cuentas bancarias y los QR que se muestran al activar una cuenta (ADR 0029). */
export function CuentasDeCobroPage() {
  const { t } = useTranslation(['cobro', 'comun']);
  const cuentas = useCuentasDeCobro();
  const cambiarActivo = useCambiarActivoDeCuentaDeCobro();
  const eliminar = useEliminarCuentaDeCobro();
  const { sesion } = useSesion();
  const permisos = sesion?.permisos ?? [];
  const [dialogo, setDialogo] = useState<{ cuenta: CuentaDeCobro | null } | null>(null);
  const [aEliminar, setAEliminar] = useState<CuentaDeCobro | null>(null);
  const lista = cuentas.data ?? [];

  return (
    <>
      <EncabezadoPagina
        titulo={t('cobro:titulo')}
        subtitulo={t('cobro:subtitulo')}
        accion={
          tienePermiso(permisos, 'suscripciones.cobro.crear') ? (
            <AccesoBoton
              icono="add"
              onClick={() => {
                setDialogo({ cuenta: null });
              }}
            >
              {t('cobro:nueva')}
            </AccesoBoton>
          ) : undefined
        }
      />

      {cuentas.isError ? (
        <EstadoError
          titulo={t('cobro:errorCarga')}
          code={codigoDe(cuentas.error)}
          onReintentar={() => void cuentas.refetch()}
        />
      ) : cuentas.isPending ? (
        <div className={styles.rejilla} aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} alto="bloque" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <EstadoVacio titulo={t('cobro:vacio.titulo')} texto={t('cobro:vacio.texto')} />
      ) : (
        <div className={styles.rejilla}>
          {lista.map((cuenta) => (
            <TarjetaCuentaDeCobro
              key={cuenta.id}
              cuenta={cuenta}
              acciones={
                <>
                  {tienePermiso(permisos, 'suscripciones.cobro.editar') ? (
                    <AccesoInterruptor
                      etiqueta={t('cobro:activa')}
                      checked={cuenta.activo}
                      disabled={cambiarActivo.isPending}
                      onChange={(e) => {
                        cambiarActivo.mutate({ id: cuenta.id, activo: e.target.checked });
                      }}
                    />
                  ) : null}
                  <span className={styles.empuje} />
                  {tienePermiso(permisos, 'suscripciones.cobro.editar') ? (
                    <BotonIcono
                      icono="edit"
                      accion="editar"
                      etiqueta={t('cobro:editarCuenta', { banco: cuenta.banco })}
                      onClick={() => {
                        setDialogo({ cuenta });
                      }}
                    />
                  ) : null}
                  {tienePermiso(permisos, 'suscripciones.cobro.eliminar') ? (
                    <BotonIcono
                      icono="delete"
                      accion="eliminar"
                      etiqueta={t('cobro:eliminarCuenta', { banco: cuenta.banco })}
                      onClick={() => {
                        setAEliminar(cuenta);
                      }}
                    />
                  ) : null}
                </>
              }
            />
          ))}
        </div>
      )}

      <DialogoCuentaDeCobro
        abierto={dialogo !== null}
        cuenta={dialogo?.cuenta ?? null}
        onCerrar={() => {
          setDialogo(null);
        }}
      />
      <ConfirmarDialogo
        abierto={aEliminar !== null}
        peligro
        titulo={t('cobro:eliminarTitulo', { banco: aEliminar?.banco ?? '' })}
        texto={t('cobro:eliminarTexto')}
        etiquetaConfirmar={eliminar.isPending ? t('cobro:eliminando') : t('cobro:eliminar')}
        cargando={eliminar.isPending}
        onCancelar={() => {
          setAEliminar(null);
        }}
        onConfirmar={() => {
          if (aEliminar) {
            eliminar.mutate(aEliminar.id, {
              onSettled: () => {
                setAEliminar(null);
              },
            });
          }
        }}
      />
    </>
  );
}
