import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IDIOMAS, cambiarIdioma, type Idioma } from '../../../../l10n';
import { formatearFecha, formatearHora } from '../../../../l10n/formatos';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { Avatar } from '../../../../shared/ui/atoms/Avatar';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { EncabezadoPagina } from '../../../../shared/ui/molecules/EncabezadoPagina';
import { useTema, type PreferenciaTema } from '../../../../theme/ProveedorTema';
import { useSesion } from '../../application/SesionProvider';
import { useCerrarSesion, usePerfil } from '../../application/useSeguridad';
import { DialogoContrasena } from '../components/DialogoContrasena';
import { DialogoNombre } from '../components/DialogoNombre';
import { DialogoOpciones } from '../components/DialogoOpciones';
import { FilaDeAjuste } from '../components/FilaDeAjuste';
import styles from './PerfilPage.module.css';

const TEMAS: readonly PreferenciaTema[] = ['claro', 'oscuro', 'sistema'];

type Ajuste = 'nombre' | 'tema' | 'idioma' | 'contrasena';

/**
 * A12: el perfil como una lista de ajustes, como en el móvil. Cada fila muestra su valor actual y
 * al tocarla abre un modal para cambiarlo; ningún formulario vive en la página.
 */
export function PerfilPage() {
  const { t, i18n } = useTranslation(['perfil', 'comun']);
  const { sesion } = useSesion();
  const perfil = usePerfil();
  const cerrar = useCerrarSesion();
  const { preferencia, elegir } = useTema();
  const [abierto, setAbierto] = useState<Ajuste | null>(null);
  const cerrarModal = () => {
    setAbierto(null);
  };

  const datos = perfil.data;
  const nombre = datos?.nombre ?? sesion?.usuario.nombre ?? '';
  const idioma = IDIOMAS.find((i) => i === i18n.language) ?? 'es';
  return (
    <div className={styles.pagina}>
      <EncabezadoPagina titulo={t('perfil:titulo')} />
      {sesion?.debeCambiarContrasena ? (
        <Aviso tono="advertencia">{t('perfil:temporal')}</Aviso>
      ) : null}

      <section className={styles.persona}>
        <Avatar grande nombre={nombre} />
        <div>
          <h2 className={styles.nombre}>{nombre}</h2>
          {datos ? (
            <p className={styles.rol}>
              {t('perfil:rol', { fecha: formatearFecha(datos.creadoEn).slice(3) })}
            </p>
          ) : null}
        </div>
      </section>

      <section className={styles.grupo} aria-label={t('perfil:grupoCuenta')}>
        <FilaDeAjuste
          etiqueta={t('perfil:nombre')}
          valor={nombre}
          onAbrir={() => {
            setAbierto('nombre');
          }}
        />
        <FilaDeAjuste
          etiqueta={t('perfil:usuario')}
          valor={<TextoMono>{datos?.usuario ?? sesion?.usuario.usuario}</TextoMono>}
        />
        <FilaDeAjuste
          etiqueta={t('perfil:ultimoIngreso')}
          valor={
            datos?.ultimoIngresoEn ? (
              <TextoMono>
                {formatearFecha(datos.ultimoIngresoEn)} {formatearHora(datos.ultimoIngresoEn)}
              </TextoMono>
            ) : null
          }
        />
      </section>

      <section className={styles.grupo} aria-label={t('perfil:grupoPreferencias')}>
        <FilaDeAjuste
          etiqueta={t('perfil:tema')}
          valor={t(`perfil:temas.${preferencia}`)}
          onAbrir={() => {
            setAbierto('tema');
          }}
        />
        <FilaDeAjuste
          etiqueta={t('perfil:idioma')}
          valor={t(`perfil:idiomas.${idioma}`)}
          onAbrir={() => {
            setAbierto('idioma');
          }}
        />
      </section>

      <section className={styles.grupo} aria-label={t('perfil:grupoSeguridad')}>
        <FilaDeAjuste
          etiqueta={t('perfil:cambiarContrasena')}
          onAbrir={() => {
            setAbierto('contrasena');
          }}
        />
      </section>

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

      <DialogoNombre
        key={nombre}
        abierto={abierto === 'nombre'}
        nombreActual={nombre}
        onCerrar={cerrarModal}
      />
      <DialogoOpciones
        abierto={abierto === 'tema'}
        titulo={t('perfil:tema')}
        valor={preferencia}
        opciones={TEMAS.map((tema) => ({ valor: tema, etiqueta: t(`perfil:temas.${tema}`) }))}
        onElegir={elegir}
        onCerrar={cerrarModal}
      />
      <DialogoOpciones
        abierto={abierto === 'idioma'}
        titulo={t('perfil:idioma')}
        valor={idioma}
        opciones={IDIOMAS.map((i) => ({ valor: i, etiqueta: t(`perfil:idiomas.${i}`) }))}
        onElegir={(elegido: Idioma) => {
          void cambiarIdioma(elegido);
        }}
        onCerrar={cerrarModal}
      />
      <DialogoContrasena abierto={abierto === 'contrasena'} onCerrar={cerrarModal} />
    </div>
  );
}
