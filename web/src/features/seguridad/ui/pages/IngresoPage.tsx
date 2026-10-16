import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router-dom';
import { formatearCuentaRegresiva } from '../../../../l10n/formatos';
import { traducirError } from '../../../../l10n/traducirError';
import { ErrorApi } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { AccesoCampoTexto } from '../../../../shared/ui/molecules/AccesoCampoTexto';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { CampoContrasena } from '../../../../shared/ui/molecules/CampoContrasena';
import { PantallaDeCarga } from '../../../../shared/ui/organisms/PantallaDeCarga';
import { PlantillaAuth } from '../../../../shared/ui/templates/PlantillaAuth';
import { useSesion } from '../../application/SesionProvider';
import { useCuentaRegresiva } from '../../application/useCuentaRegresiva';
import { useIngresar } from '../../application/useSeguridad';
import styles from './IngresoPage.module.css';

interface Formulario {
  usuario: string;
  contrasena: string;
}

/** A01: ingreso con usuario y contraseña; A01b: cargando, credenciales incorrectas y bloqueo con cuenta regresiva. */
export function IngresoPage() {
  const { t } = useTranslation(['auth', 'errores']);
  const { sesion, vencida, restaurando } = useSesion();
  const ubicacion = useLocation();
  const ingresar = useIngresar();
  const { register, handleSubmit } = useForm<Formulario>({
    defaultValues: { usuario: '', contrasena: '' },
  });
  const [finDeEspera, setFinDeEspera] = useState<number | null>(null);
  const restantes = useCuentaRegresiva(finDeEspera);
  const bloqueado = restantes > 0;
  const textoDeEspera = Number.isFinite(restantes) ? formatearCuentaRegresiva(restantes) : '--:--';

  const error = ingresar.error instanceof ErrorApi ? ingresar.error : null;
  const credenciales = error?.code === 'sesion.credenciales_invalidas';
  const bloqueo = error?.code === 'sesion.bloqueada';

  if (restaurando) return <PantallaDeCarga />;
  if (sesion) {
    const destino = (ubicacion.state as { desde?: string } | null)?.desde ?? '/';
    return <Navigate to={destino} replace />;
  }

  const enviar = handleSubmit((datos) => {
    ingresar.mutate(datos, {
      onError: (e) => {
        if (e instanceof ErrorApi && e.code === 'sesion.bloqueada') {
          const segundos = e.extra.reintentar_en_segundos;
          setFinDeEspera(typeof segundos === 'number' ? Date.now() + segundos * 1000 : null);
        }
      },
    });
  });

  return (
    <PlantillaAuth>
      <form className={styles.formulario} onSubmit={(e) => void enviar(e)} noValidate>
        <div>
          <h1 className={styles.titulo}>{t('auth:titulo')}</h1>
          <p className={styles.subtitulo}>{t('auth:subtitulo')}</p>
        </div>
        {vencida ? (
          <Aviso tono="advertencia">
            <strong>{t('auth:sesionVencida.titulo')}</strong> {t('auth:sesionVencida.texto')}
          </Aviso>
        ) : null}
        {bloqueo ? <Aviso tono="peligro">{traducirError(t, error.code)}</Aviso> : null}
        <AccesoCampoTexto
          etiqueta={t('auth:usuario')}
          autoComplete="username"
          autoCapitalize="none"
          invalido={credenciales}
          disabled={ingresar.isPending}
          {...register('usuario', { required: true })}
        />
        <CampoContrasena
          etiqueta={t('auth:contrasena')}
          autoComplete="current-password"
          invalido={credenciales}
          error={credenciales ? traducirError(t, error.code) : undefined}
          disabled={ingresar.isPending}
          {...register('contrasena', { required: true })}
        />
        <AccesoBoton type="submit" bloque cargando={ingresar.isPending} disabled={bloqueado}>
          {ingresar.isPending
            ? t('auth:ingresando')
            : bloqueado
              ? t('auth:ingresarEn', { tiempo: textoDeEspera })
              : t('auth:ingresar')}
        </AccesoBoton>
        {error && !credenciales && !bloqueo ? (
          <Aviso tono="peligro">{traducirError(t, error.code)}</Aviso>
        ) : null}
        <p className={styles.olvido}>{t('auth:olvido')}</p>
      </form>
    </PlantillaAuth>
  );
}
