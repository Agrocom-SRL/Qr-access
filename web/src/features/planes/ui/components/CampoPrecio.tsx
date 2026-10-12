import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatearNumero } from '../../../../l10n/formatos';
import { Icono } from '../../../../shared/ui/atoms/Icono';
import { parsearPrecio } from '../../domain/plan';
import styles from './CampoPrecio.module.css';

interface Props {
  id: string;
  etiqueta: string;
  /** Texto accesible del campo (qué plan se edita). */
  etiquetaAccesible: string;
  valor: number;
  onCambio: (valor: number) => void;
  /** Avisa si lo escrito es un monto válido, para bloquear "Guardar precios" mientras no lo sea. */
  onValidez?: (valido: boolean) => void;
  /** Sin esto, el campo marca error cuando lo escrito no es un monto entero. */
  deshabilitado?: boolean;
}

/** Precio anual en bolivianos: prefijo "Bs", valor en mono con puntos de miles y lápiz de edición. */
export function CampoPrecio({
  id,
  etiqueta,
  etiquetaAccesible,
  valor,
  onCambio,
  onValidez,
  deshabilitado,
}: Props) {
  const { t } = useTranslation('planes');
  const [texto, setTexto] = useState<string | null>(null);
  const invalido = texto !== null && parsearPrecio(texto) === null;
  return (
    <div className={styles.campo}>
      <label htmlFor={id} className={styles.etiqueta}>
        {etiqueta}
      </label>
      <div className={styles.caja} data-invalido={invalido || undefined}>
        <span className={styles.moneda}>{t('moneda')}</span>
        <input
          id={id}
          className={styles.entrada}
          inputMode="numeric"
          aria-label={etiquetaAccesible}
          aria-invalid={invalido || undefined}
          disabled={deshabilitado}
          value={texto ?? formatearNumero(valor)}
          onChange={(e) => {
            setTexto(e.target.value);
            const nuevo = parsearPrecio(e.target.value);
            onValidez?.(nuevo !== null);
            if (nuevo !== null) onCambio(nuevo);
          }}
          onBlur={() => {
            setTexto(null);
            onValidez?.(true);
          }}
        />
        <span className={styles.lapiz}>
          <Icono nombre="edit" tamano={20} />
        </span>
      </div>
      {invalido ? <p className={styles.error}>{t('precioInvalido')}</p> : null}
    </div>
  );
}
