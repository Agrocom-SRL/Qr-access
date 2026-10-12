import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icono } from '../../../../shared/ui/atoms/Icono';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { MAX_BYTES_DE_COMPROBANTE, TIPOS_DE_COMPROBANTE } from '../../domain/pago';
import styles from './CampoComprobante.module.css';

interface Props {
  archivo: File | null;
  /** Mensaje de error ya traducido. */
  error?: string;
  onCambio: (archivo: File | null) => void;
  onBlur?: () => void;
}

const tamano = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${String(Math.max(1, Math.round(bytes / 1024)))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/**
 * Adjunta la foto o el PDF del comprobante de una transferencia o un depósito (ADR 0024). Muestra
 * una vista previa si es una imagen; la API vuelve a revisar el contenido real al recibirlo.
 */
export function CampoComprobante({ archivo, error, onCambio, onBlur }: Props) {
  const { t } = useTranslation('pago');
  const id = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [vista, setVista] = useState<string | null>(null);

  // La vista previa se crea al elegir el archivo (no en un efecto) y se libera al cambiarlo o al salir.
  const vistaActual = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (vistaActual.current) URL.revokeObjectURL(vistaActual.current);
    },
    [],
  );
  const cambiarArchivo = (nuevo: File | null) => {
    if (vistaActual.current) URL.revokeObjectURL(vistaActual.current);
    vistaActual.current = nuevo?.type.startsWith('image/') ? URL.createObjectURL(nuevo) : null;
    setVista(vistaActual.current);
    onCambio(nuevo);
  };

  const elegir = () => entrada.current?.click();

  return (
    <div className={styles.campo}>
      <span className={styles.etiqueta} id={`${id}-etiqueta`}>
        {t('comprobante')}
      </span>
      <input
        ref={entrada}
        id={id}
        className={styles.entrada}
        type="file"
        accept={TIPOS_DE_COMPROBANTE.join(',')}
        aria-labelledby={`${id}-etiqueta`}
        aria-invalid={error ? true : undefined}
        onChange={(e) => {
          cambiarArchivo(e.target.files?.[0] ?? null);
          e.target.value = '';
          onBlur?.();
        }}
      />
      {archivo ? (
        <div className={styles.elegido}>
          {vista ? (
            <img src={vista} alt={t('comprobanteVista')} className={styles.vista} />
          ) : (
            <span className={styles.pdf}>
              <Icono nombre="receipt_long" />
            </span>
          )}
          <div className={styles.datos}>
            <strong className={styles.nombre}>{archivo.name}</strong>
            <span className={styles.peso}>{tamano(archivo.size)}</span>
          </div>
          <AccesoBoton variante="texto" onClick={elegir}>
            {t('comprobanteCambiar')}
          </AccesoBoton>
          <AccesoBoton
            variante="texto"
            onClick={() => {
              cambiarArchivo(null);
              onBlur?.();
            }}
          >
            {t('comprobanteQuitar')}
          </AccesoBoton>
        </div>
      ) : (
        <button type="button" className={styles.zona} onClick={elegir}>
          <Icono nombre="upload_file" />
          <span>{t('comprobanteSubir')}</span>
          <span className={styles.ayuda}>
            {t('comprobanteAyuda', { max: MAX_BYTES_DE_COMPROBANTE / (1024 * 1024) })}
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
