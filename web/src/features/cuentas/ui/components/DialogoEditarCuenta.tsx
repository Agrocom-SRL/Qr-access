import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { AccesoCampoTexto } from '../../../../shared/ui/molecules/AccesoCampoTexto';
import { AccesoSelectorBuscable } from '../../../../shared/ui/molecules/AccesoSelectorBuscable';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import { useEditarCuenta } from '../../application/useCuentas';
import { CIUDADES, validarEmpresa, type DatosDeEmpresa } from '../../domain/alta';
import type { DetalleDeCuenta } from '../../domain/cuenta';
import styles from './DialogoEditarCuenta.module.css';

type Datos = Omit<DatosDeEmpresa, 'codigo'>;

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  detalle: DetalleDeCuenta;
}

/** Datos con los que arranca el formulario: los vigentes de la cuenta. */
function iniciales(detalle: DetalleDeCuenta): Datos {
  return {
    razonSocial: detalle.cuenta.nombre,
    nit: detalle.empresa?.nit ?? '',
    ciudad: detalle.empresa?.ciudad ?? '',
    contactoNombre: detalle.empresa?.contactoNombre ?? '',
    contactoApellido: detalle.empresa?.contactoApellido ?? '',
    contactoTelefono: detalle.empresa?.telefono ?? '',
    contactoCorreo: detalle.empresa?.correo ?? '',
  };
}

/**
 * Corrige los datos de la cuenta: razón social, NIT, ciudad y la persona responsable. El código no
 * se edita acá (tiene su propio diálogo, ADR 0023).
 */
export function DialogoEditarCuenta({ abierto, onCerrar, detalle }: Props) {
  const { t } = useTranslation(['detalle', 'crearCuenta', 'comun']);
  const editar = useEditarCuenta(detalle.cuenta.id);
  const [datos, setDatos] = useState<Datos>(() => iniciales(detalle));
  const [tocados, setTocados] = useState<ReadonlySet<keyof Datos>>(new Set());

  const errores = validarEmpresa({ ...datos, codigo: detalle.cuenta.codigo });
  const mensaje = (campo: keyof Datos): string | undefined => {
    const error = errores[campo];
    return tocados.has(campo) && error ? t(`crearCuenta:${error}`) : undefined;
  };
  const tocar = (campo: keyof Datos) => {
    setTocados((actual) => new Set(actual).add(campo));
  };
  const cambiar = (parcial: Partial<Datos>) => {
    setDatos((actual) => ({ ...actual, ...parcial }));
  };
  const cerrar = () => {
    setDatos(iniciales(detalle));
    setTocados(new Set());
    editar.reset();
    onCerrar();
  };
  const valido = Object.keys(errores).length === 0;

  return (
    <Dialogo
      abierto={abierto}
      titulo={t('detalle:editarTitulo', { cuenta: detalle.cuenta.nombre })}
      ancho="amplio"
      onCerrar={cerrar}
      acciones={
        <>
          <AccesoBoton variante="texto" onClick={cerrar}>
            {t('comun:cancelar')}
          </AccesoBoton>
          <AccesoBoton
            cargando={editar.isPending}
            disabled={!valido}
            onClick={() => {
              editar.mutate(datos, { onSuccess: cerrar });
            }}
          >
            {editar.isPending ? t('detalle:guardando') : t('detalle:guardarCambios')}
          </AccesoBoton>
        </>
      }
    >
      <div className={styles.campos}>
        <AccesoCampoTexto
          etiqueta={t('crearCuenta:razonSocial')}
          value={datos.razonSocial}
          error={mensaje('razonSocial')}
          onBlur={() => {
            tocar('razonSocial');
          }}
          onChange={(e) => {
            cambiar({ razonSocial: e.target.value });
          }}
        />
        <div className={styles.fila}>
          <AccesoCampoTexto
            etiqueta={t('crearCuenta:nit')}
            value={datos.nit}
            inputMode="numeric"
            error={mensaje('nit')}
            onBlur={() => {
              tocar('nit');
            }}
            onChange={(e) => {
              cambiar({ nit: e.target.value });
            }}
          />
          <AccesoSelectorBuscable
            etiqueta={t('crearCuenta:ciudad')}
            valor={datos.ciudad}
            error={mensaje('ciudad')}
            placeholder={t('crearCuenta:ciudadElegir')}
            onBlur={() => {
              tocar('ciudad');
            }}
            opciones={[...new Set([datos.ciudad, ...CIUDADES])]
              .filter((ciudad) => ciudad !== '')
              .map((ciudad) => ({ valor: ciudad, etiqueta: ciudad }))}
            onCambio={(ciudad) => {
              cambiar({ ciudad });
            }}
          />
        </div>
        <p className={styles.seccion}>{t('crearCuenta:responsableTitulo')}</p>
        <div className={styles.fila}>
          <AccesoCampoTexto
            etiqueta={t('crearCuenta:responsableNombre')}
            value={datos.contactoNombre}
            error={mensaje('contactoNombre')}
            autoComplete="given-name"
            onBlur={() => {
              tocar('contactoNombre');
            }}
            onChange={(e) => {
              cambiar({ contactoNombre: e.target.value });
            }}
          />
          <AccesoCampoTexto
            etiqueta={t('crearCuenta:responsableApellido')}
            value={datos.contactoApellido}
            error={mensaje('contactoApellido')}
            autoComplete="family-name"
            onBlur={() => {
              tocar('contactoApellido');
            }}
            onChange={(e) => {
              cambiar({ contactoApellido: e.target.value });
            }}
          />
        </div>
        <div className={styles.fila}>
          <AccesoCampoTexto
            etiqueta={t('crearCuenta:telefono')}
            value={datos.contactoTelefono}
            mono
            type="tel"
            error={mensaje('contactoTelefono')}
            onBlur={() => {
              tocar('contactoTelefono');
            }}
            onChange={(e) => {
              cambiar({ contactoTelefono: e.target.value });
            }}
          />
          <AccesoCampoTexto
            etiqueta={t('crearCuenta:correo')}
            value={datos.contactoCorreo}
            type="email"
            error={mensaje('contactoCorreo')}
            autoComplete="email"
            onBlur={() => {
              tocar('contactoCorreo');
            }}
            onChange={(e) => {
              cambiar({ contactoCorreo: e.target.value });
            }}
          />
        </div>
      </div>
      {editar.isError ? (
        <Aviso tono="peligro">{traducirError(t, codigoDe(editar.error))}</Aviso>
      ) : null}
    </Dialogo>
  );
}
