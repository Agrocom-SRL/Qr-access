import { useState } from 'react';
import { useForm, type FieldErrors, type Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { IDIOMAS, cambiarIdioma, type Idioma } from '../../../../l10n';
import { formatearFecha, formatearHora } from '../../../../l10n/formatos';
import { traducirError } from '../../../../l10n/traducirError';
import { cx } from '../../../../shared/lib/cx';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { Avatar } from '../../../../shared/ui/atoms/Avatar';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { AccesoCampoTexto } from '../../../../shared/ui/molecules/AccesoCampoTexto';
import { CampoContrasena } from '../../../../shared/ui/molecules/CampoContrasena';
import { EncabezadoPagina } from '../../../../shared/ui/molecules/EncabezadoPagina';
import { FilaClaveValor } from '../../../../shared/ui/molecules/FilaClaveValor';
import { FiltroSegmentado } from '../../../../shared/ui/molecules/FiltroSegmentado';
import { useTema, type PreferenciaTema } from '../../../../theme/ProveedorTema';
import { useSesion } from '../../application/SesionProvider';
import {
  useCambiarContrasena,
  useCambiarNombre,
  useCerrarSesion,
  usePerfil,
} from '../../application/useSeguridad';
import {
  LARGO_MINIMO_DE_CONTRASENA,
  validarCambioDeContrasena,
  type CambioDeContrasena,
} from '../../domain/contrasena';
import styles from './PerfilPage.module.css';

const TEMAS: readonly PreferenciaTema[] = ['claro', 'oscuro', 'sistema'];

/** Valida con las reglas del dominio; el mensaje es el tipo de error y la página lo traduce. */
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

/** A12: datos del perfil, cambio de contraseña, tema y cierre de sesión. */
export function PerfilPage() {
  const { t, i18n } = useTranslation(['perfil', 'comun']);
  const { sesion } = useSesion();
  const perfil = usePerfil();
  const cambiar = useCambiarContrasena();
  const cerrar = useCerrarSesion();
  const cambiarNombre = useCambiarNombre();
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombre, setNombre] = useState('');
  const { preferencia, elegir } = useTema();
  const { register, handleSubmit, reset, formState } = useForm<CambioDeContrasena>({
    defaultValues: { actual: '', nueva: '', repetida: '' },
    resolver,
  });

  const mensaje = (campo: keyof CambioDeContrasena): string | undefined => {
    const tipo = formState.errors[campo]?.message;
    return tipo ? t(`perfil:${tipo}`, { count: LARGO_MINIMO_DE_CONTRASENA }) : undefined;
  };
  const errorDeApi = cambiar.error ? traducirError(t, codigoDe(cambiar.error)) : undefined;

  const enviar = handleSubmit((datos) => {
    cambiar.mutate(
      { actual: datos.actual, nueva: datos.nueva },
      {
        onSuccess: () => {
          reset();
        },
      },
    );
  });

  const datos = perfil.data;
  return (
    <div className={styles.pagina}>
      <EncabezadoPagina titulo={t('perfil:titulo')} />
      {sesion?.debeCambiarContrasena ? (
        <Aviso tono="advertencia">{t('perfil:temporal')}</Aviso>
      ) : null}

      <section className={styles.tarjeta}>
        <div className={styles.persona}>
          <Avatar grande nombre={datos?.nombre ?? sesion?.usuario.nombre ?? ''} />
          <div className={styles.identidad}>
            <h2 className={styles.nombre}>{datos?.nombre ?? sesion?.usuario.nombre}</h2>
            {datos ? (
              <p className={styles.rol}>
                {t('perfil:rol', { fecha: formatearFecha(datos.creadoEn).slice(3) })}
              </p>
            ) : null}
          </div>
          {editandoNombre ? null : (
            <AccesoBoton
              variante="advertencia"
              icono="edit"
              onClick={() => {
                setNombre(datos?.nombre ?? sesion?.usuario.nombre ?? '');
                setEditandoNombre(true);
              }}
            >
              {t('perfil:editarNombre')}
            </AccesoBoton>
          )}
        </div>
        {editandoNombre ? (
          <form
            className={styles.nombreEdicion}
            onSubmit={(e) => {
              e.preventDefault();
              cambiarNombre.mutate(nombre, {
                onSuccess: () => {
                  setEditandoNombre(false);
                },
              });
            }}
          >
            <AccesoCampoTexto
              etiqueta={t('perfil:nombre')}
              value={nombre}
              autoComplete="name"
              error={
                cambiarNombre.error ? traducirError(t, codigoDe(cambiarNombre.error)) : undefined
              }
              onChange={(e) => {
                setNombre(e.target.value);
              }}
            />
            <div className={styles.accion}>
              <AccesoBoton
                variante="texto"
                onClick={() => {
                  setEditandoNombre(false);
                  cambiarNombre.reset();
                }}
              >
                {t('comun:cancelar')}
              </AccesoBoton>
              <AccesoBoton
                type="submit"
                cargando={cambiarNombre.isPending}
                disabled={nombre.trim() === ''}
              >
                {cambiarNombre.isPending ? t('perfil:guardando') : t('perfil:guardarNombre')}
              </AccesoBoton>
            </div>
          </form>
        ) : null}
        <dl className={styles.datos}>
          <FilaClaveValor clave={t('perfil:usuario')}>
            <TextoMono>{datos?.usuario ?? sesion?.usuario.usuario}</TextoMono>
          </FilaClaveValor>
          <FilaClaveValor clave={t('perfil:ultimoIngreso')}>
            {datos?.ultimoIngresoEn ? (
              <TextoMono>
                {formatearFecha(datos.ultimoIngresoEn)} {formatearHora(datos.ultimoIngresoEn)}
              </TextoMono>
            ) : null}
          </FilaClaveValor>
        </dl>
      </section>

      <section className={cx(styles.tarjeta, styles.tema)}>
        <h2 className={styles.seccion}>{t('perfil:tema')}</h2>
        <FiltroSegmentado
          etiqueta={t('perfil:tema')}
          valor={preferencia}
          onCambio={elegir}
          opciones={TEMAS.map((tema) => ({ valor: tema, etiqueta: t(`perfil:temas.${tema}`) }))}
        />
      </section>

      <section className={cx(styles.tarjeta, styles.tema)}>
        <h2 className={styles.seccion}>{t('perfil:idioma')}</h2>
        <FiltroSegmentado
          etiqueta={t('perfil:idioma')}
          valor={IDIOMAS.find((idioma) => idioma === i18n.language) ?? 'es'}
          onCambio={(idioma: Idioma) => {
            void cambiarIdioma(idioma);
          }}
          opciones={IDIOMAS.map((idioma) => ({
            valor: idioma,
            etiqueta: t(`perfil:idiomas.${idioma}`),
          }))}
        />
      </section>

      <form className={styles.tarjeta} onSubmit={(e) => void enviar(e)} noValidate>
        <h2 className={styles.seccion}>{t('perfil:cambiarContrasena')}</h2>
        <div className={styles.campos}>
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
        </div>
        <div className={styles.accion}>
          <AccesoBoton type="submit" variante="tonal" cargando={cambiar.isPending}>
            {cambiar.isPending ? t('perfil:actualizando') : t('perfil:actualizar')}
          </AccesoBoton>
          {cambiar.isSuccess ? <span role="status">{t('perfil:actualizada')}</span> : null}
        </div>
      </form>

      <div>
        <AccesoBoton
          variante="peligro"
          icono="logout"
          cargando={cerrar.isPending}
          onClick={() => {
            cerrar.mutate();
          }}
        >
          {t('perfil:cerrarSesion')}
        </AccesoBoton>
      </div>
    </div>
  );
}
