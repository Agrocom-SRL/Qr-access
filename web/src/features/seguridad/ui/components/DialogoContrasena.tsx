import { useForm, type FieldErrors, type Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { CampoContrasena } from '../../../../shared/ui/molecules/CampoContrasena';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import { useCambiarContrasena } from '../../application/useSeguridad';
import {
  LARGO_MINIMO_DE_CONTRASENA,
  validarCambioDeContrasena,
  type CambioDeContrasena,
} from '../../domain/contrasena';
import styles from './DialogoContrasena.module.css';

/** Valida con las reglas del dominio; el mensaje es el tipo de error y el modal lo traduce. */
const resolver: Resolver<CambioDeContrasena> = (valores) => {
  const errores = validarCambioDeContrasena(valores);
  const errors: FieldErrors<CambioDeContrasena> = {};
  for (const campo of ['actual', 'nueva', 'repetida'] as const) {
    const tipo = errores[campo];
    if (tipo) errors[campo] = { type: tipo, message: tipo };
  }
  return Object.keys(errors).length === 0
    ? { values: valores, errors: {} }
    : { values: {}, errors };
};

interface Props {
  abierto: boolean;
  onCerrar: () => void;
}

/** Modal ancho con los tres campos del cambio de contraseña; la página solo muestra una fila. */
export function DialogoContrasena({ abierto, onCerrar }: Props) {
  const { t } = useTranslation(['perfil', 'comun']);
  const cambiar = useCambiarContrasena();
  const { register, handleSubmit, reset, formState } = useForm<CambioDeContrasena>({
    defaultValues: { actual: '', nueva: '', repetida: '' },
    resolver,
  });

  const mensaje = (campo: keyof CambioDeContrasena): string | undefined => {
    const tipo = formState.errors[campo]?.message;
    return tipo ? t(`perfil:${tipo}`, { count: LARGO_MINIMO_DE_CONTRASENA }) : undefined;
  };
  const errorDeApi = cambiar.error ? traducirError(t, codigoDe(cambiar.error)) : undefined;
  const cerrar = () => {
    reset();
    cambiar.reset();
    onCerrar();
  };
  const enviar = handleSubmit((datos) => {
    cambiar.mutate({ actual: datos.actual, nueva: datos.nueva }, { onSuccess: cerrar });
  });

  return (
    <Dialogo
      abierto={abierto}
      titulo={t('perfil:cambiarContrasena')}
      ancho="ancho"
      onCerrar={cerrar}
      acciones={
        <>
          <AccesoBoton variante="texto" onClick={cerrar}>
            {t('comun:cancelar')}
          </AccesoBoton>
          <AccesoBoton type="submit" form="form-contrasena" cargando={cambiar.isPending}>
            {cambiar.isPending ? t('perfil:actualizando') : t('perfil:actualizar')}
          </AccesoBoton>
        </>
      }
    >
      <form
        id="form-contrasena"
        className={styles.campos}
        onSubmit={(e) => void enviar(e)}
        noValidate
      >
        <CampoContrasena
          sinOjo
          etiqueta={t('perfil:actual')}
          autoComplete="current-password"
          error={mensaje('actual') ?? errorDeApi}
          {...register('actual')}
        />
        <CampoContrasena
          sinOjo
          etiqueta={t('perfil:nueva')}
          autoComplete="new-password"
          placeholder={t('perfil:minimo', { count: LARGO_MINIMO_DE_CONTRASENA })}
          error={mensaje('nueva')}
          {...register('nueva')}
        />
        <CampoContrasena
          sinOjo
          etiqueta={t('perfil:repetir')}
          autoComplete="new-password"
          error={mensaje('repetida')}
          {...register('repetida')}
        />
      </form>
    </Dialogo>
  );
}
