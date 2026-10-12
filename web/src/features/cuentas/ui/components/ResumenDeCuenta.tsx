import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatearFecha, formatearMonto } from '../../../../l10n/formatos';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { Icono } from '../../../../shared/ui/atoms/Icono';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { BarraUso } from '../../../../shared/ui/molecules/BarraUso';
import { FilaClaveValor } from '../../../../shared/ui/molecules/FilaClaveValor';
import { TarjetaIndicador } from '../../../../shared/ui/organisms/TarjetaIndicador';
import { tienePermiso, useSesion } from '../../../seguridad';
import foto from '../../../../shared/ui/assets/fotos/camino_banner.webp';
import { usuariosDisponibles, type DetalleDeCuenta } from '../../domain/cuenta';
import { AdministradoresDeCuenta } from './AdministradoresDeCuenta';
import { DialogoCambiarCodigo } from './DialogoCambiarCodigo';
import styles from './ResumenDeCuenta.module.css';

/** El texto del vencimiento según el estado de la suscripción (A05a). */
function textoDeVencimiento(
  suscripcion: NonNullable<DetalleDeCuenta['suscripcion']>,
  t: (clave: string, opciones?: Record<string, unknown>) => string,
): string {
  const fecha = formatearFecha(suscripcion.hasta);
  if (suscripcion.estado === 'pendientePago') return t('detalle:pendienteTexto');
  if (suscripcion.estado === 'suspendida') return t('detalle:suspendidaTexto');
  if (suscripcion.estado === 'vencida') {
    return t('detalle:vencioEl', { fecha, dias: Math.abs(suscripcion.diasRestantes) });
  }
  return suscripcion.diasRestantes <= 0
    ? t('detalle:venceHoy', { fecha })
    : t('detalle:venceEl', { fecha, dias: suscripcion.diasRestantes });
}

/** Pestaña "Resumen" de la ficha: plan y uso, datos de la empresa y tres indicadores (A05a). */
export function ResumenDeCuenta({ detalle }: { detalle: DetalleDeCuenta }) {
  const { t } = useTranslation(['detalle', 'planes']);
  const { suscripcion, empresa, uso } = detalle;
  const { sesion } = useSesion();
  const puedeCambiarCodigo = tienePermiso(
    sesion?.permisos ?? [],
    'seguridad.cuenta.cambiar_codigo',
  );
  const puedeRegenerar = tienePermiso(
    sesion?.permisos ?? [],
    'seguridad.administrador.regenerar_pin',
  );
  const [cambiandoCodigo, setCambiandoCodigo] = useState(false);
  const cupo = suscripcion?.plan.cupoUsuarios ?? null;
  const disponibles = usuariosDisponibles(uso.usuariosActivos, cupo);

  return (
    <div className={styles.rejilla}>
      <section className={styles.hero} aria-labelledby="plan-actual">
        <img src={foto} alt="" className={styles.foto} />
        {suscripcion ? (
          <>
            <div className={styles.cabecera}>
              <div>
                <p id="plan-actual" className={styles.etiqueta}>
                  {t('detalle:planActual')}
                </p>
                <h2 className={styles.plan}>
                  {t('detalle:hastaUsuarios', { count: suscripcion.plan.cupoUsuarios ?? 0 })}
                </h2>
                <p className={styles.precio}>
                  {t('detalle:qrIlimitadosPrecio', {
                    precio: formatearMonto(suscripcion.plan.precioAnual),
                  })}
                </p>
              </div>
              <span className={styles.medalla}>
                <Icono nombre="workspace_premium" tamano={32} />
              </span>
            </div>
            <div>
              <div className={styles.uso}>
                <span>{t('detalle:usuariosActivos')}</span>
                {cupo === null ? (
                  <TextoMono fuerte>{uso.usuariosActivos}</TextoMono>
                ) : (
                  <TextoMono fuerte>
                    {uso.usuariosActivos} / {cupo}
                  </TextoMono>
                )}
              </div>
              {cupo === null ? null : (
                <BarraUso grande sinEtiqueta usados={uso.usuariosActivos} cupo={cupo} />
              )}
              <p className={styles.puede}>
                {disponibles === null
                  ? t('detalle:sinTope')
                  : t('detalle:puedeCrear', { count: disponibles })}
              </p>
            </div>
            <p className={styles.vence}>
              <Icono nombre="event" tamano={20} />
              <span>{textoDeVencimiento(suscripcion, t)}</span>
            </p>
          </>
        ) : (
          <>
            <p id="plan-actual" className={styles.etiqueta}>
              {t('detalle:planActual')}
            </p>
            <p className={styles.vence}>
              <Icono nombre="event_busy" tamano={20} />
              <span>{t('detalle:sinSuscripcion')}</span>
            </p>
          </>
        )}
      </section>

      <section className={styles.empresa} aria-labelledby="datos-empresa">
        <h2 id="datos-empresa" className={styles.tituloEmpresa}>
          {t('detalle:empresa')}
        </h2>
        {empresa ? (
          <dl className={styles.datos}>
            <FilaClaveValor clave={t('detalle:razonSocial')}>
              {detalle.cuenta.nombre}
            </FilaClaveValor>
            <FilaClaveValor clave={t('detalle:codigo')}>
              <span className={styles.codigo}>
                <TextoMono fuerte>{detalle.cuenta.codigo}</TextoMono>
                {puedeCambiarCodigo ? (
                  <AccesoBoton
                    variante="texto"
                    onClick={() => {
                      setCambiandoCodigo(true);
                    }}
                  >
                    {t('detalle:cambiarCodigo')}
                  </AccesoBoton>
                ) : null}
              </span>
            </FilaClaveValor>
            <FilaClaveValor clave={t('detalle:nit')}>{empresa.nit}</FilaClaveValor>
            <FilaClaveValor clave={t('detalle:ciudad')}>{empresa.ciudad}</FilaClaveValor>
            <FilaClaveValor clave={t('detalle:responsable')}>{empresa.contacto}</FilaClaveValor>
            <FilaClaveValor clave={t('detalle:telefono')}>{empresa.telefono}</FilaClaveValor>
            <FilaClaveValor clave={t('detalle:correo')}>{empresa.correo ?? '—'}</FilaClaveValor>
            <FilaClaveValor clave={t('detalle:clienteDesde')}>
              {formatearFecha(detalle.cuenta.clienteDesde)}
            </FilaClaveValor>
          </dl>
        ) : (
          <p className={styles.sinDatos}>{t('detalle:sinEmpresa')}</p>
        )}
      </section>

      <div className={styles.administradores}>
        <AdministradoresDeCuenta cuentaId={detalle.cuenta.id} puedeRegenerar={puedeRegenerar} />
      </div>

      <div className={styles.indicadores}>
        <TarjetaIndicador
          etiqueta={t('detalle:sitiosYPuertas')}
          valor={`${String(uso.sitios)} · ${String(uso.puertas)}`}
          icono="door_front"
        />
        <TarjetaIndicador
          etiqueta={t('detalle:dispositivosSinConexion')}
          valor={String(uso.dispositivosSinConexion)}
          icono="wifi_off"
          tono={uso.dispositivosSinConexion > 0 ? 'peligro' : 'primario'}
        />
        <TarjetaIndicador
          etiqueta={t('detalle:administradores')}
          valor={String(uso.administradores)}
          icono="admin_panel_settings"
        />
      </div>
      <DialogoCambiarCodigo
        abierto={cambiandoCodigo}
        cuenta={detalle.cuenta}
        onCerrar={() => {
          setCambiandoCodigo(false);
        }}
      />
    </div>
  );
}
