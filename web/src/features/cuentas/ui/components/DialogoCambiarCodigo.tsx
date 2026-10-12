import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { Icono } from '../../../../shared/ui/atoms/Icono';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { CampoFormulario } from '../../../../shared/ui/molecules/CampoFormulario';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import { useCambiarCodigo, useCodigoDisponible } from '../../application/useCuentas';
import { normalizarCodigo } from '../../domain/alta';
import styles from './DialogoCambiarCodigo.module.css';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  cuenta: { id: string; nombre: string; codigo: string };
}

/**
 * Cambia el código de la cuenta: las 3 primeras letras del PIN de todos sus usuarios cambian y el
 * resto queda igual (ADR 0023). Valida contra la API que el código nuevo esté libre.
 */
export function DialogoCambiarCodigo({ abierto, onCerrar, cuenta }: Props) {
  const { t } = useTranslation(['detalle', 'crearCuenta', 'comun']);
  const cambiar = useCambiarCodigo(cuenta.id);
  const [codigo, setCodigo] = useState('');
  const { resultado, verificando } = useCodigoDisponible(codigo, cuenta.nombre);

  const cerrar = () => {
    setCodigo('');
    cambiar.reset();
    onCerrar();
  };
  const esElMismo = codigo === cuenta.codigo;
  const libre = codigo.length === 3 && !esElMismo && resultado?.disponible === true;
  const ocupado = !esElMismo && resultado?.disponible === false && resultado.formatoValido;

  return (
    <Dialogo
      abierto={abierto}
      titulo={t('detalle:cambiarCodigoTitulo', { cuenta: cuenta.nombre })}
      onCerrar={cerrar}
      acciones={
        <>
          <AccesoBoton variante="texto" onClick={cerrar}>
            {t('comun:cancelar')}
          </AccesoBoton>
          <AccesoBoton
            cargando={cambiar.isPending}
            disabled={!libre}
            onClick={() => {
              cambiar.mutate(codigo, { onSuccess: cerrar });
            }}
          >
            {cambiar.isPending ? t('detalle:cambiandoCodigo') : t('detalle:confirmarCodigo')}
          </AccesoBoton>
        </>
      }
    >
      <p className={styles.texto}>{t('detalle:cambiarCodigoTexto')}</p>
      <CampoFormulario
        etiqueta={t('detalle:codigoNuevo')}
        error={esElMismo ? traducirError(t, 'cuenta.codigo_sin_cambio') : undefined}
        invalido={ocupado}
      >
        {(control) => (
          <div className={styles.campo}>
            <input
              className={styles.entrada}
              value={codigo}
              maxLength={3}
              autoComplete="off"
              autoCapitalize="characters"
              onChange={(e) => {
                setCodigo(normalizarCodigo(e.target.value));
              }}
              {...control}
            />
            {ocupado ? (
              <p className={styles.error} role="alert">
                <Icono nombre="error" tamano={20} />
                {t('crearCuenta:codigoExiste', { cuenta: resultado.usadoPor ?? '' })}
              </p>
            ) : libre ? (
              <p className={styles.libre} role="status">
                <Icono nombre="check_circle" tamano={20} />
                {t('crearCuenta:codigoDisponible')}
              </p>
            ) : verificando ? (
              <p className={styles.verificando}>{t('crearCuenta:verificando')}</p>
            ) : null}
          </div>
        )}
      </CampoFormulario>
      {libre ? (
        <p className={styles.texto}>
          {t('detalle:codigoUsos', { antes: cuenta.codigo, despues: codigo })}
        </p>
      ) : null}
      {cambiar.isError ? (
        <Aviso tono="peligro">{traducirError(t, codigoDe(cambiar.error))}</Aviso>
      ) : null}
    </Dialogo>
  );
}
