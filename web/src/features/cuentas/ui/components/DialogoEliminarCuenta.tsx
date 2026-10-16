import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { AccesoCampoTexto } from '../../../../shared/ui/molecules/AccesoCampoTexto';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import { useEliminarCuenta } from '../../application/useCuentas';
import { normalizarCodigo } from '../../domain/alta';
import styles from './DialogoEditarCuenta.module.css';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  /** Se llama cuando la cuenta ya se dio de baja (la ficha deja de existir). */
  onEliminada: () => void;
  cuenta: { id: string; nombre: string; codigo: string };
}

/** Da de baja la cuenta: nadie de ella vuelve a ingresar. Se confirma escribiendo su código. */
export function DialogoEliminarCuenta({ abierto, onCerrar, onEliminada, cuenta }: Props) {
  const { t } = useTranslation(['detalle', 'comun']);
  const eliminar = useEliminarCuenta(cuenta.id);
  const [codigo, setCodigo] = useState('');
  const cerrar = () => {
    setCodigo('');
    eliminar.reset();
    onCerrar();
  };
  return (
    <Dialogo
      abierto={abierto}
      icono="warning"
      titulo={t('detalle:eliminarTitulo', { cuenta: cuenta.nombre })}
      onCerrar={cerrar}
      acciones={
        <>
          <AccesoBoton variante="texto" onClick={cerrar}>
            {t('comun:cancelar')}
          </AccesoBoton>
          <AccesoBoton
            variante="peligro"
            cargando={eliminar.isPending}
            disabled={codigo !== cuenta.codigo}
            onClick={() => {
              eliminar.mutate(codigo, {
                onSuccess: () => {
                  cerrar();
                  onEliminada();
                },
              });
            }}
          >
            {eliminar.isPending ? t('detalle:eliminando') : t('detalle:eliminar')}
          </AccesoBoton>
        </>
      }
    >
      <div className={styles.campos}>
        <p>{t('detalle:eliminarTexto')}</p>
        <AccesoCampoTexto
          etiqueta={t('detalle:eliminarConfirmar', { codigo: cuenta.codigo })}
          mono
          value={codigo}
          maxLength={3}
          autoComplete="off"
          autoCapitalize="characters"
          onChange={(e) => {
            setCodigo(normalizarCodigo(e.target.value));
          }}
        />
      </div>
      {eliminar.isError ? (
        <Aviso tono="peligro">{traducirError(t, codigoDe(eliminar.error))}</Aviso>
      ) : null}
    </Dialogo>
  );
}
