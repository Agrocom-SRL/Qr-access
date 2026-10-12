import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatearFecha, formatearMonto } from '../../../../l10n/formatos';
import { traducirError } from '../../../../l10n/traducirError';
import { cx } from '../../../../shared/lib/cx';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { Icono } from '../../../../shared/ui/atoms/Icono';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { FilaClaveValor } from '../../../../shared/ui/molecules/FilaClaveValor';
import { FiltroSegmentado } from '../../../../shared/ui/molecules/FiltroSegmentado';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import { usePlanes } from '../../../planes';
import { useCambiarPlan } from '../../application/useSuscripcion';
import {
  diferenciaDePrecio,
  opcionesDeMejora,
  type PlanContratado,
} from '../../domain/suscripcion';
import type { PlanCambiado } from '../../api/SuscripcionesRepositorio';
import styles from './DialogoCambiarPlan.module.css';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  cuenta: { id: string; nombre: string; codigo: string; usuariosActivos: number };
  planActual: PlanContratado;
  hasta: Date;
  /** Se invoca tras cambiar el plan, con lo que hay que cobrar. */
  onCambiado: (cambio: PlanCambiado) => void;
}

/**
 * A06: compara el plan actual con el nuevo y confirma. Solo ofrece planes de MAYOR cupo: nunca se
 * baja de plan en mitad de la suscripción (no se devuelve dinero) y la diferencia se cobra (ADR 0022).
 */
export function DialogoCambiarPlan({
  abierto,
  onCerrar,
  cuenta,
  planActual,
  hasta,
  onCambiado,
}: Props) {
  const { t } = useTranslation(['cambiarPlan', 'comun']);
  const planes = usePlanes();
  const cambiar = useCambiarPlan(cuenta.id);
  const [elegido, setElegido] = useState<string | null>(null);

  const opciones = opcionesDeMejora(planes.data ?? [], planActual);
  const nuevo = opciones.find((plan) => plan.id === (elegido ?? opciones[0]?.id)) ?? null;

  const cerrar = () => {
    setElegido(null);
    cambiar.reset();
    onCerrar();
  };
  const confirmar = () => {
    if (!nuevo) return;
    cambiar.mutate(nuevo.id, {
      onSuccess: (cambio) => {
        setElegido(null);
        onCambiado(cambio);
      },
    });
  };

  return (
    <Dialogo
      abierto={abierto}
      titulo={t('cambiarPlan:titulo')}
      ancho="ancho"
      onCerrar={cerrar}
      acciones={
        <>
          <AccesoBoton variante="texto" onClick={cerrar}>
            {t('comun:cancelar')}
          </AccesoBoton>
          <AccesoBoton cargando={cambiar.isPending} disabled={nuevo === null} onClick={confirmar}>
            {cambiar.isPending
              ? t('cambiarPlan:cambiando')
              : t('cambiarPlan:confirmar', { count: nuevo?.cupoUsuarios ?? 0 })}
          </AccesoBoton>
        </>
      }
    >
      <p className={styles.subtitulo}>
        {t('cambiarPlan:subtitulo', {
          cuenta: cuenta.nombre,
          codigo: cuenta.codigo,
          count: cuenta.usuariosActivos,
        })}
      </p>

      {planes.isSuccess && nuevo === null ? (
        <Aviso tono="informacion">{t('cambiarPlan:sinMejora')}</Aviso>
      ) : nuevo ? (
        <>
          {opciones.length > 1 ? (
            <FiltroSegmentado
              etiqueta={t('cambiarPlan:elegir')}
              valor={nuevo.id}
              onCambio={setElegido}
              opciones={opciones.map((plan) => ({
                valor: plan.id,
                etiqueta: t('cambiarPlan:usuarios', { count: plan.cupoUsuarios ?? 0 }),
              }))}
            />
          ) : null}
          <div className={styles.comparacion}>
            <div className={styles.plan}>
              <span className={styles.etiqueta}>{t('cambiarPlan:actual')}</span>
              <strong className={styles.cupo}>
                {t('cambiarPlan:usuarios', { count: planActual.cupoUsuarios ?? 0 })}
              </strong>
              <span className={styles.precio}>
                <TextoMono>
                  {t('cambiarPlan:precioAnio', { precio: formatearMonto(planActual.precioAnual) })}
                </TextoMono>
              </span>
            </div>
            <Icono nombre="arrow_forward" />
            <div className={cx(styles.plan, styles.nuevo)}>
              <span className={styles.etiqueta}>{t('cambiarPlan:nuevo')}</span>
              <strong className={styles.cupo}>
                {t('cambiarPlan:usuarios', { count: nuevo.cupoUsuarios ?? 0 })}
              </strong>
              <span className={styles.precio}>
                <TextoMono>
                  {t('cambiarPlan:precioAnio', { precio: formatearMonto(nuevo.precioAnual) })}
                </TextoMono>
              </span>
            </div>
          </div>
          <dl>
            <FilaClaveValor clave={t('cambiarPlan:diferencia')}>
              <TextoMono fuerte>
                + {formatearMonto(diferenciaDePrecio(planActual, nuevo))}
              </TextoMono>
            </FilaClaveValor>
            <FilaClaveValor clave={t('cambiarPlan:qr')}>
              {t('cambiarPlan:qrIlimitados')}
            </FilaClaveValor>
            <FilaClaveValor clave={t('cambiarPlan:vencimiento')}>
              <TextoMono>{t('cambiarPlan:sinCambio', { fecha: formatearFecha(hasta) })}</TextoMono>
            </FilaClaveValor>
          </dl>
          <Aviso tono="exito" icono="group_add">
            {t('cambiarPlan:efecto', { count: nuevo.cupoUsuarios ?? 0 })}
          </Aviso>
          <p className={styles.nota}>{t('cambiarPlan:soloMejora')}</p>
        </>
      ) : null}
      {cambiar.isError ? (
        <Aviso tono="peligro">{traducirError(t, codigoDe(cambiar.error))}</Aviso>
      ) : null}
    </Dialogo>
  );
}
