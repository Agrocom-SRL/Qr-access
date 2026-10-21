import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { AccesoCampoTexto } from '../../../../shared/ui/molecules/AccesoCampoTexto';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import type { AdministradorCreado } from '../../api/CuentasRepositorio';
import { useCrearAdministrador } from '../../application/useCuentas';
import { sufijoDePinValido } from '../../domain/cuenta';
import styles from './DialogoAgregarAdministrador.module.css';

/** Largo máximo del nombre (`usuarios.etiqueta` en la API). */
const LARGO_MAXIMO_DEL_NOMBRE = 80;

interface Props {
  abierto: boolean;
  cuentaId: string;
  onCerrar: () => void;
  /** El Administrador ya está creado: quien llama muestra su PIN una sola vez. */
  onCreado: (creado: AdministradorCreado) => void;
}

/**
 * Suma otro Administrador a la cuenta (ADR 0028 §1: puede haber varios). Pide su nombre y, si se
 * quiere, los 4 caracteres del PIN; si no, los sortea el servidor. AGROCOM nunca conoce un PIN que
 * no acaba de generar: se muestra una sola vez al terminar.
 */
export function DialogoAgregarAdministrador({ abierto, cuentaId, onCerrar, onCreado }: Props) {
  const { t } = useTranslation(['detalle', 'comun']);
  const crear = useCrearAdministrador(cuentaId);
  const [nombre, setNombre] = useState('');
  const [sufijo, setSufijo] = useState('');
  const [tocado, setTocado] = useState(false);

  const nombreLimpio = nombre.trim();
  const errorDeNombre = nombreLimpio === '' ? t('detalle:agregarAdminNombreRequerido') : undefined;
  const errorDeSufijo =
    sufijo !== '' && !sufijoDePinValido(sufijo)
      ? t('detalle:agregarAdminSufijoInvalido')
      : undefined;
  const valido = errorDeNombre === undefined && errorDeSufijo === undefined;

  const cerrar = () => {
    setNombre('');
    setSufijo('');
    setTocado(false);
    crear.reset();
    onCerrar();
  };

  return (
    <Dialogo
      abierto={abierto}
      titulo={t('detalle:agregarAdminTitulo')}
      ancho="ancho"
      onCerrar={cerrar}
      acciones={
        <>
          <AccesoBoton variante="texto" onClick={cerrar}>
            {t('comun:cancelar')}
          </AccesoBoton>
          <AccesoBoton
            cargando={crear.isPending}
            disabled={!valido}
            onClick={() => {
              setTocado(true);
              crear.mutate(
                {
                  etiqueta: nombreLimpio,
                  ...(sufijo === '' ? {} : { sufijo: sufijo.toUpperCase() }),
                },
                {
                  onSuccess: (creado) => {
                    cerrar();
                    onCreado(creado);
                  },
                },
              );
            }}
          >
            {crear.isPending ? t('detalle:agregarAdminCreando') : t('detalle:agregarAdminCrear')}
          </AccesoBoton>
        </>
      }
    >
      <p className={styles.texto}>{t('detalle:agregarAdminTexto')}</p>
      <div className={styles.campos}>
        <AccesoCampoTexto
          etiqueta={t('detalle:agregarAdminNombre')}
          value={nombre}
          maxLength={LARGO_MAXIMO_DEL_NOMBRE}
          error={tocado ? errorDeNombre : undefined}
          autoComplete="off"
          onBlur={() => {
            setTocado(true);
          }}
          onChange={(e) => {
            setNombre(e.target.value);
          }}
        />
        <AccesoCampoTexto
          etiqueta={t('detalle:agregarAdminSufijo')}
          ayuda={t('detalle:agregarAdminSufijoAyuda')}
          value={sufijo}
          mono
          maxLength={4}
          error={errorDeSufijo}
          autoComplete="off"
          onChange={(e) => {
            setSufijo(e.target.value);
          }}
        />
      </div>
      {crear.isError ? (
        <Aviso tono="peligro">{traducirError(t, codigoDe(crear.error))}</Aviso>
      ) : null}
    </Dialogo>
  );
}
