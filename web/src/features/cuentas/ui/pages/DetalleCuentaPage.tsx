import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ErrorApi, codigoDe } from '../../../../shared/api/errorApi';
import { rutaDePago } from '../../../../shared/lib/rutas';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { BadgeSuscripcion } from '../../../../shared/ui/atoms/BadgeSuscripcion';
import { Skeleton } from '../../../../shared/ui/atoms/Skeleton';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { Migas } from '../../../../shared/ui/molecules/Migas';
import { EstadoError } from '../../../../shared/ui/organisms/EstadoError';
import { EstadoVacio } from '../../../../shared/ui/organisms/EstadoVacio';
import { Pestanas } from '../../../../shared/ui/organisms/Pestanas';
import { PestanaBitacora } from '../../../bitacora';
import { tienePermiso, useSesion } from '../../../seguridad';
import { PestanaSuscripcion } from '../../../suscripciones';
import { useDetalleDeCuenta } from '../../application/useCuentas';
import { RUTAS_DE_CUENTAS } from '../../rutas';
import { DialogoEditarCuenta } from '../components/DialogoEditarCuenta';
import { DialogoEliminarCuenta } from '../components/DialogoEliminarCuenta';
import { ResumenDeCuenta } from '../components/ResumenDeCuenta';
import { SitiosYPuertas } from '../components/SitiosYPuertas';
import styles from './DetalleCuentaPage.module.css';

type PestanaDeCuenta = 'resumen' | 'suscripcion' | 'sitios' | 'bitacora';
const PESTANAS: readonly PestanaDeCuenta[] = ['resumen', 'suscripcion', 'sitios', 'bitacora'];

/** A05: ficha de una cuenta con pestañas (la pestaña activa vive en la URL: `?pestana=sitios`). */
export function DetalleCuentaPage() {
  const { t } = useTranslation(['detalle', 'comun']);
  const { id = '' } = useParams();
  const [parametros, setParametros] = useSearchParams();
  const detalle = useDetalleDeCuenta(id);
  const navegar = useNavigate();
  const { sesion } = useSesion();
  const permisos = sesion?.permisos ?? [];
  // `?editar=1` abre el diálogo de edición: la lista de cuentas enlaza así desde su acción de editar.
  const [editando, setEditando] = useState(parametros.get('editar') === '1');
  const [eliminando, setEliminando] = useState(false);
  const pedida = parametros.get('pestana');
  const pestana = PESTANAS.find((p) => p === pedida) ?? 'resumen';

  if (detalle.isError) {
    const noEncontrada = detalle.error instanceof ErrorApi && detalle.error.status === 404;
    return noEncontrada ? (
      <EstadoVacio
        ilustracion="error"
        titulo={t('detalle:noEncontrada.titulo')}
        texto={t('detalle:noEncontrada.texto')}
        accion={
          <Link to={RUTAS_DE_CUENTAS.lista}>
            <AccesoBoton variante="tonal" icono="arrow_back" tabIndex={-1}>
              {t('detalle:volverCuentas')}
            </AccesoBoton>
          </Link>
        }
      />
    ) : (
      <EstadoError
        titulo={t('detalle:errorCarga')}
        code={codigoDe(detalle.error)}
        onReintentar={() => void detalle.refetch()}
      />
    );
  }

  const datos = detalle.data;
  return (
    <>
      <header className={styles.cabecera}>
        <div>
          <Migas
            migas={[
              { etiqueta: t('detalle:migas'), ruta: RUTAS_DE_CUENTAS.lista },
              { etiqueta: datos?.cuenta.codigo ?? '…' },
            ]}
          />
          {datos ? (
            <h1 className={styles.titulo}>
              {datos.cuenta.nombre}
              {datos.suscripcion ? <BadgeSuscripcion estado={datos.suscripcion.estado} /> : null}
            </h1>
          ) : (
            <div className={styles.cargandoTitulo}>
              <Skeleton ancho="medio" />
            </div>
          )}
        </div>
        {datos ? (
          <div className={styles.acciones}>
            {datos.suscripcion?.estado === 'pendientePago' &&
            tienePermiso(permisos, 'suscripciones.pago.registrar') ? (
              <AccesoBoton
                icono="payments"
                onClick={() => {
                  void navegar(rutaDePago(id));
                }}
              >
                {t('detalle:registrarPago')}
              </AccesoBoton>
            ) : null}
            {tienePermiso(permisos, 'seguridad.cuenta.editar') ? (
              <AccesoBoton
                variante="advertencia"
                icono="edit"
                onClick={() => {
                  setEditando(true);
                }}
              >
                {t('detalle:editar')}
              </AccesoBoton>
            ) : null}
            {tienePermiso(permisos, 'seguridad.cuenta.eliminar') ? (
              <AccesoBoton
                variante="peligro"
                icono="delete"
                onClick={() => {
                  setEliminando(true);
                }}
              >
                {t('detalle:eliminar')}
              </AccesoBoton>
            ) : null}
          </div>
        ) : null}
      </header>
      {datos?.suscripcion?.estado === 'pendientePago' ? (
        <Aviso tono="advertencia">{t('detalle:pendienteAviso')}</Aviso>
      ) : null}
      <Pestanas
        etiqueta={t('detalle:pestanasEtiqueta')}
        activa={pestana}
        onCambio={(siguiente) => {
          setParametros(siguiente === 'resumen' ? {} : { pestana: siguiente }, { replace: true });
        }}
        pestanas={PESTANAS.map((p) => ({ id: p, etiqueta: t(`detalle:tabs.${p}`) }))}
      />
      <div className={styles.contenido}>
        {pestana === 'resumen' ? (
          datos ? (
            <ResumenDeCuenta detalle={datos} />
          ) : (
            <div aria-busy="true">
              <Skeleton alto="bloque" />
            </div>
          )
        ) : pestana === 'suscripcion' ? (
          datos ? (
            <PestanaSuscripcion
              cuenta={{
                id,
                nombre: datos.cuenta.nombre,
                codigo: datos.cuenta.codigo,
                usuariosActivos: datos.uso.usuariosActivos,
              }}
            />
          ) : (
            <div aria-busy="true">
              <Skeleton alto="bloque" />
            </div>
          )
        ) : pestana === 'bitacora' ? (
          <PestanaBitacora cuentaId={id} />
        ) : (
          <SitiosYPuertas cuentaId={id} />
        )}
      </div>
      {datos ? (
        <>
          <DialogoEditarCuenta
            key={`${datos.cuenta.nombre}-${datos.empresa?.nit ?? ''}-${datos.empresa?.correo ?? ''}`}
            abierto={editando}
            onCerrar={() => {
              setEditando(false);
              if (parametros.has('editar')) {
                const resto = new URLSearchParams(parametros);
                resto.delete('editar');
                setParametros(resto, { replace: true });
              }
            }}
            detalle={datos}
          />
          <DialogoEliminarCuenta
            abierto={eliminando}
            cuenta={{ id, nombre: datos.cuenta.nombre, codigo: datos.cuenta.codigo }}
            onCerrar={() => {
              setEliminando(false);
            }}
            onEliminada={() => {
              void navegar(RUTAS_DE_CUENTAS.lista);
            }}
          />
        </>
      ) : null}
    </>
  );
}
