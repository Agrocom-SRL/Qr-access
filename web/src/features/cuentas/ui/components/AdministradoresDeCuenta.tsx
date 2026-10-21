import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatearFecha } from '../../../../l10n/formatos';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { Avatar } from '../../../../shared/ui/atoms/Avatar';
import { Skeleton } from '../../../../shared/ui/atoms/Skeleton';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { ConfirmarDialogo } from '../../../../shared/ui/organisms/ConfirmarDialogo';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import { EstadoError } from '../../../../shared/ui/organisms/EstadoError';
import { PinUnaVez } from '../../../../shared/ui/organisms/PinUnaVez';
import { useAdministradores, useRegenerarPin } from '../../application/useCuentas';
import type { AdministradorDeCuenta } from '../../api/CuentasRepositorio';
import { DialogoAgregarAdministrador } from './DialogoAgregarAdministrador';
import styles from './AdministradoresDeCuenta.module.css';

interface PinMostrado {
  nombre: string;
  /** Vive solo en este estado y se descarta al cerrar: nunca en la caché ni en un log. */
  pin: string;
  /** `true` si es un Administrador recién sumado; `false` si se regeneró el PIN de uno que ya estaba. */
  esNuevo: boolean;
}

/**
 * Los administradores de la cuenta y el botón para regenerar su PIN (ADR 0023). AGROCOM no conoce
 * ningún PIN: sortea uno nuevo, lo muestra una sola vez y el anterior deja de servir.
 */
export function AdministradoresDeCuenta({
  cuentaId,
  puedeRegenerar,
  puedeAgregar,
}: {
  cuentaId: string;
  /** Permiso `seguridad.administrador.regenerar_pin`; la autoridad es la API. */
  puedeRegenerar: boolean;
  /** Permiso `seguridad.administrador.crear`: sumar otro Administrador a la cuenta (ADR 0028). */
  puedeAgregar: boolean;
}) {
  const { t } = useTranslation(['detalle', 'comun']);
  const lista = useAdministradores(cuentaId);
  const regenerar = useRegenerarPin(cuentaId);
  const [aRegenerar, setARegenerar] = useState<AdministradorDeCuenta | null>(null);
  const [mostrado, setMostrado] = useState<PinMostrado | null>(null);
  const [agregando, setAgregando] = useState(false);

  const confirmar = () => {
    if (!aRegenerar) return;
    const { id, etiqueta } = aRegenerar;
    regenerar.mutate(id, {
      onSuccess: (pin) => {
        setARegenerar(null);
        setMostrado({ nombre: etiqueta, pin, esNuevo: false });
      },
    });
  };

  return (
    <section className={styles.tarjeta} aria-labelledby="administradores-titulo">
      <div className={styles.encabezado}>
        <h2 id="administradores-titulo" className={styles.titulo}>
          {t('detalle:administradoresTitulo')}
        </h2>
        {puedeAgregar ? (
          <AccesoBoton
            variante="tonal"
            icono="person_add"
            onClick={() => {
              setAgregando(true);
            }}
          >
            {t('detalle:agregarAdmin')}
          </AccesoBoton>
        ) : null}
      </div>
      {lista.isError ? (
        <EstadoError
          titulo={t('detalle:errorAdministradores')}
          code={codigoDe(lista.error)}
          onReintentar={() => void lista.refetch()}
        />
      ) : lista.isPending ? (
        <Skeleton alto="bloque" />
      ) : lista.data.length === 0 ? (
        <p className={styles.suave}>{t('detalle:administradoresVacio')}</p>
      ) : (
        <ul className={styles.lista}>
          {lista.data.map((admin) => (
            <li key={admin.id} className={styles.fila}>
              <Avatar nombre={admin.etiqueta} />
              <div className={styles.datos}>
                <strong>{admin.etiqueta}</strong>
                <span className={styles.suave}>
                  {admin.ultimoIngresoEn
                    ? t('detalle:ultimoIngreso', { fecha: formatearFecha(admin.ultimoIngresoEn) })
                    : t('detalle:nuncaIngreso')}
                  {' · '}
                  {admin.pinGeneradoEn
                    ? t('detalle:pinGenerado', { fecha: formatearFecha(admin.pinGeneradoEn) })
                    : t('detalle:sinPin')}
                </span>
              </div>
              {puedeRegenerar ? (
                <AccesoBoton
                  variante="tonal"
                  icono="autorenew"
                  aria-label={t('detalle:regenerarPinDe', { nombre: admin.etiqueta })}
                  onClick={() => {
                    setARegenerar(admin);
                  }}
                >
                  {t('detalle:regenerarPin')}
                </AccesoBoton>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {regenerar.isError ? (
        <Aviso tono="peligro">{traducirError(t, codigoDe(regenerar.error))}</Aviso>
      ) : null}

      <ConfirmarDialogo
        abierto={aRegenerar !== null}
        titulo={t('detalle:regenerarTitulo', { nombre: aRegenerar?.etiqueta ?? '' })}
        texto={t('detalle:regenerarTexto')}
        etiquetaConfirmar={
          regenerar.isPending ? t('detalle:regenerando') : t('detalle:regenerarPin')
        }
        cargando={regenerar.isPending}
        onCancelar={() => {
          setARegenerar(null);
        }}
        onConfirmar={confirmar}
      />
      <Dialogo
        abierto={mostrado !== null}
        titulo={
          mostrado?.esNuevo === true
            ? t('detalle:adminNuevoTitulo', { nombre: mostrado.nombre })
            : t('detalle:pinNuevoTitulo', { nombre: mostrado?.nombre ?? '' })
        }
        onCerrar={() => {
          setMostrado(null);
        }}
        acciones={
          <AccesoBoton
            onClick={() => {
              setMostrado(null);
            }}
          >
            {t('detalle:listo')}
          </AccesoBoton>
        }
      >
        {mostrado ? (
          <PinUnaVez
            titulo={t('detalle:pinNuevoDe', { nombre: mostrado.nombre })}
            pin={mostrado.pin}
            aviso={mostrado.esNuevo ? t('detalle:adminNuevoAviso') : t('detalle:pinNuevoAviso')}
          />
        ) : null}
      </Dialogo>
      <DialogoAgregarAdministrador
        abierto={agregando}
        cuentaId={cuentaId}
        onCerrar={() => {
          setAgregando(false);
        }}
        onCreado={(creado) => {
          setMostrado({ nombre: creado.etiqueta, pin: creado.pin, esNuevo: true });
        }}
      />
    </section>
  );
}
