import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { Icono } from '../../../../shared/ui/atoms/Icono';
import { MAX_BYTES_DE_IMAGEN, TIPOS_DE_IMAGEN } from '../../domain/cuentaDeCobro';
import { ImagenDeCobro } from './ImagenDeCobro';
import styles from './CampoImagenQr.module.css';

interface Props {
  /** El QR nuevo elegido. */
  archivo: File | null;
  /** El QR que la cuenta ya tiene (al editar). */
  imagenActualId: string | null;
  banco: string;
  /** Mensaje de error ya traducido. */
  error?: string;
  onCambio: (archivo: File | null) => void;
}

/** Adjunta la imagen del QR de cobro; muestra la vista previa de la nueva o el QR que ya tiene la cuenta. */
export function CampoImagenQr({ archivo, imagenActualId, banco, error, onCambio }: Props) {
  const { t } = useTranslation('cobro');
  const id = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [vista, setVista] = useState<string | null>(null);

  // La vista previa se crea al elegir el archivo y se libera al cambiarlo o al salir.
  const vistaActual = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (vistaActual.current) URL.revokeObjectURL(vistaActual.current);
    },
    [],
  );
  const cambiarArchivo = (nuevo: File | null) => {
    if (vistaActual.current) URL.revokeObjectURL(vistaActual.current);
    vistaActual.current = nuevo ? URL.createObjectURL(nuevo) : null;
    setVista(vistaActual.current);
    onCambio(nuevo);
  };
  const elegir = () => entrada.current?.click();

  return (
    <div className={styles.campo}>
      <span className={styles.etiqueta} id={`${id}-etiqueta`}>
        {t('imagen')}
      </span>
      <input
        ref={entrada}
        className={styles.entrada}
        type="file"
        accept={TIPOS_DE_IMAGEN.join(',')}
        aria-labelledby={`${id}-etiqueta`}
        aria-invalid={error ? true : undefined}
        onChange={(e) => {
          cambiarArchivo(e.target.files?.[0] ?? null);
          e.target.value = '';
        }}
      />
      {archivo && vista ? (
        <div className={styles.elegido}>
          <img src={vista} alt={t('imagenVista')} className={styles.vista} />
          <div className={styles.datos}>
            <strong className={styles.nombre}>{archivo.name}</strong>
          </div>
          <AccesoBoton variante="texto" onClick={elegir}>
            {t('imagenCambiar')}
          </AccesoBoton>
        </div>
      ) : imagenActualId !== null ? (
        <div className={styles.elegido}>
          <div className={styles.vista}>
            <ImagenDeCobro imagenId={imagenActualId} banco={banco} />
          </div>
          <div className={styles.datos}>
            <strong className={styles.nombre}>{t('imagenActual')}</strong>
          </div>
          <AccesoBoton variante="texto" onClick={elegir}>
            {t('imagenCambiar')}
          </AccesoBoton>
        </div>
      ) : (
        <button type="button" className={styles.zona} onClick={elegir}>
          <Icono nombre="upload_file" />
          <span>{t('imagenSubir')}</span>
          <span className={styles.ayuda}>
            {t('imagenAyuda', { max: MAX_BYTES_DE_IMAGEN / (1024 * 1024) })}
          </span>
        </button>
      )}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
