import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import {
  formatearFecha,
  formatearHora,
  formatearMonto,
  formatearNumero,
  relacionDeDia,
} from '../../../../l10n/formatos';
import { codigoDe } from '../../../../shared/api/errorApi';
import { RUTAS } from '../../../../shared/lib/rutas';
import { AccesoBadge } from '../../../../shared/ui/atoms/AccesoBadge';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { BadgeSuscripcion } from '../../../../shared/ui/atoms/BadgeSuscripcion';
import { Skeleton } from '../../../../shared/ui/atoms/Skeleton';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { BarraUso } from '../../../../shared/ui/molecules/BarraUso';
import { EncabezadoPagina } from '../../../../shared/ui/molecules/EncabezadoPagina';
import { EstadoError } from '../../../../shared/ui/organisms/EstadoError';
import { EstadoVacio } from '../../../../shared/ui/organisms/EstadoVacio';
import { TarjetaIndicador } from '../../../../shared/ui/organisms/TarjetaIndicador';
import { describirEvento } from '../../../bitacora';
import { GraficasDelResumen } from '../../../estadisticas';
import { useResumen } from '../../application/useResumen';
import { porcentajeDeUso } from '../../domain/resumen';
import foto from '../../../../shared/ui/assets/fotos/portico_banner.webp';
import styles from './ResumenPage.module.css';

const DISPOSITIVOS_A_MOSTRAR = 8;

/** A02: el tablero con cuentas, usuarios, vencimientos, ingresos, renovaciones próximas y últimas acciones. */
export function ResumenPage() {
  const { t, i18n } = useTranslation(['resumen', 'comun', 'bitacora', 'cuentas']);
  const navegar = useNavigate();
  const consulta = useResumen();

  if (consulta.isError) {
    return (
      <EstadoError
        titulo={t('resumen:errorCarga')}
        code={codigoDe(consulta.error)}
        onReintentar={() => void consulta.refetch()}
      />
    );
  }

  const datos = consulta.data;
  const dia = datos
    ? new Intl.DateTimeFormat(i18n.language, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'America/La_Paz',
      }).format(datos.actualizadoEn)
    : '';

  const cuando = (fecha: Date) => {
    const relacion = relacionDeDia(fecha);
    const hora = formatearHora(fecha);
    if (relacion === 'hoy') return `${t('comun:hoy')} ${hora}`;
    if (relacion === 'ayer') return `${t('comun:ayer')} ${hora}`;
    return `${formatearFecha(fecha).slice(0, 5)} ${hora}`;
  };

  return (
    <>
      <EncabezadoPagina
        titulo={t('resumen:titulo')}
        subtitulo={
          datos
            ? t('resumen:fecha', {
                dia: dia.charAt(0).toUpperCase() + dia.slice(1),
                hora: formatearHora(datos.actualizadoEn),
              })
            : undefined
        }
        accion={
          <AccesoBoton
            icono="add"
            onClick={() => {
              void navegar(RUTAS.cuentaNueva);
            }}
          >
            {t('cuentas:crear')}
          </AccesoBoton>
        }
      />

      <img src={foto} alt="" className={styles.banner} />

      {datos ? (
        <div className={styles.indicadores}>
          <TarjetaIndicador
            tono="hero"
            icono="apartment"
            etiqueta={t('resumen:cuentasActivas')}
            valor={formatearNumero(datos.cuentas.activas)}
            detalle={t('resumen:cuentasDe', {
              total: datos.cuentas.total,
              porVencer: datos.cuentas.porVencer,
              count: datos.cuentas.total,
            })}
          />
          <TarjetaIndicador
            icono="group"
            etiqueta={t('resumen:usuariosEnUso')}
            valor={formatearNumero(datos.usuarios.enUso)}
            detalle={t('resumen:cupoVendido', {
              cupo: formatearNumero(datos.usuarios.cupoVendido),
              porcentaje: porcentajeDeUso(datos.usuarios.enUso, datos.usuarios.cupoVendido),
            })}
          >
            <BarraUso
              sinEtiqueta
              usados={datos.usuarios.enUso}
              cupo={Math.max(1, datos.usuarios.cupoVendido)}
            />
          </TarjetaIndicador>
          <TarjetaIndicador
            tono="advertencia"
            icono="schedule"
            etiqueta={t('resumen:porVencer30')}
            valor={formatearNumero(datos.porVencer30.cuentas)}
            detalle={t('resumen:suman', { monto: formatearMonto(datos.porVencer30.monto) })}
          />
          <TarjetaIndicador
            icono="payments"
            etiqueta={t('resumen:ingresosEsperados')}
            valor={formatearMonto(datos.ingresosEsperados)}
            detalle={t('resumen:ingresosDetalle')}
          />
        </div>
      ) : (
        <div className={styles.indicadores} aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} alto="bloque" />
          ))}
        </div>
      )}

      <GraficasDelResumen />

      <section className={styles.dispositivos} aria-labelledby="dispositivos">
        <header className={styles.cabecera}>
          <div>
            <h2 id="dispositivos" className={styles.titulo}>
              {t('resumen:dispositivos')}
            </h2>
            {datos ? (
              <p className={styles.sub}>
                {t('resumen:dispositivosResumen', {
                  enLinea: datos.dispositivos.enLinea,
                  sinConexion: datos.dispositivos.sinConexion,
                })}
              </p>
            ) : null}
          </div>
          <Link to={RUTAS.cuentas} className={styles.enlace}>
            {t('resumen:verCuentas')}
          </Link>
        </header>
        {datos === undefined ? (
          <Skeleton alto="bloque" />
        ) : datos.dispositivos.lista.length === 0 ? (
          <EstadoVacio titulo={t('resumen:dispositivosVacio')} />
        ) : (
          <ul className={styles.filas}>
            {datos.dispositivos.lista.slice(0, DISPOSITIVOS_A_MOSTRAR).map((d) => (
              <li key={d.id} className={styles.dispositivo}>
                <div>
                  <strong>{d.nombre}</strong>
                  <p className={styles.sub}>
                    <TextoMono>
                      {t('resumen:dispositivoDe', { puerta: d.puerta, codigo: d.cuenta.codigo })}
                    </TextoMono>
                  </p>
                </div>
                <span className={styles.cuando}>
                  {d.ultimoLatidoEn === null
                    ? t('resumen:sinLatido')
                    : t('resumen:ultimoLatido', { cuando: cuando(d.ultimoLatidoEn) })}
                </span>
                {d.enLinea ? (
                  <AccesoBadge tono="primario" icono="wifi">
                    {t('resumen:enLinea')}
                  </AccesoBadge>
                ) : (
                  <AccesoBadge tono="peligro" icono="wifi_off">
                    {t('resumen:sinConexion')}
                  </AccesoBadge>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className={styles.listas}>
        <section className={styles.tarjeta} aria-labelledby="renovaciones">
          <header className={styles.cabecera}>
            <h2 id="renovaciones" className={styles.titulo}>
              {t('resumen:renovacionesProximas')}
            </h2>
            <Link to={RUTAS.cobranza} className={styles.enlace}>
              {t('resumen:verCobranza')}
            </Link>
          </header>
          {datos === undefined ? (
            <Skeleton alto="bloque" />
          ) : datos.renovaciones.length === 0 ? (
            <EstadoVacio titulo={t('resumen:renovacionesVacio')} />
          ) : (
            <ul className={styles.filas}>
              {datos.renovaciones.map((r) => (
                <li key={r.cuenta.id} className={styles.renovacion}>
                  <div>
                    <strong>{r.cuenta.nombre}</strong>
                    <p className={styles.sub}>
                      <TextoMono>
                        {t('resumen:venceUna', {
                          codigo: r.cuenta.codigo,
                          fecha: formatearFecha(r.venceEl),
                        })}
                      </TextoMono>
                    </p>
                  </div>
                  <span className={styles.dias}>
                    {r.diasRestantes === 0
                      ? t('resumen:hoy')
                      : r.diasRestantes > 0
                        ? t('resumen:enDias', { count: r.diasRestantes })
                        : t('resumen:haceDias', { count: Math.abs(r.diasRestantes) })}
                  </span>
                  <TextoMono>{formatearMonto(r.monto)}</TextoMono>
                  <BadgeSuscripcion estado={r.estado} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.tarjeta} aria-labelledby="acciones">
          <header className={styles.cabecera}>
            <h2 id="acciones" className={styles.titulo}>
              {t('resumen:ultimasAcciones')}
            </h2>
            <Link to={RUTAS.bitacora} className={styles.enlace}>
              {t('resumen:verBitacora')}
            </Link>
          </header>
          {datos === undefined ? (
            <Skeleton alto="bloque" />
          ) : datos.ultimasAcciones.length === 0 ? (
            <EstadoVacio titulo={t('resumen:accionesVacio')} />
          ) : (
            <ul className={styles.filas}>
              {datos.ultimasAcciones.map((e) => {
                const d = describirEvento(e, t);
                return (
                  <li key={e.id} className={styles.accion}>
                    <div>
                      <p>
                        <strong>{e.usuario?.nombre ?? t('bitacora:sistema')}</strong> · {d.que}
                        {e.cuenta ? ` · ${e.cuenta.codigo}` : ''}
                      </p>
                      <p className={styles.sub}>
                        {d.antes} → {d.despues}
                      </p>
                    </div>
                    <span className={styles.cuando}>
                      <TextoMono>{cuando(e.ocurridoEn)}</TextoMono>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
