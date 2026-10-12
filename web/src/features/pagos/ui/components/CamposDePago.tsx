import { useTranslation } from 'react-i18next';
import { AccesoCampoTexto } from '../../../../shared/ui/molecules/AccesoCampoTexto';
import { CampoMonto } from '../../../../shared/ui/molecules/CampoMonto';
import { FiltroSegmentado } from '../../../../shared/ui/molecules/FiltroSegmentado';
import {
  MEDIOS,
  type ErrorDePago,
  type FormularioDePago,
  type MedioDePago,
} from '../../domain/pago';
import styles from './CamposDePago.module.css';

interface Props {
  datos: FormularioDePago;
  errores: Partial<Record<keyof FormularioDePago, ErrorDePago>>;
  /** Campos que la persona ya tocó: solo ellos muestran su error. */
  tocados: ReadonlySet<keyof FormularioDePago>;
  onCambio: (parcial: Partial<FormularioDePago>) => void;
  onTocar: (campo: keyof FormularioDePago) => void;
  /** Texto bajo el monto (p. ej. "Precio vigente del plan"). */
  ayudaDelMonto?: string;
}

/** Monto, fecha, medio y referencia de un pago manual: los mismos en el alta de una cuenta y en el registro de un pago. */
export function CamposDePago({ datos, errores, tocados, onCambio, onTocar, ayudaDelMonto }: Props) {
  const { t } = useTranslation('pago');
  const mensaje = (campo: keyof FormularioDePago): string | undefined => {
    const error = errores[campo];
    if (!tocados.has(campo) || !error) return undefined;
    return campo === 'monto' && error === 'formato' ? t('montoInvalido') : t(error);
  };
  return (
    <div className={styles.campos}>
      <div className={styles.fila}>
        <CampoMonto
          etiqueta={t('monto')}
          moneda={t('moneda')}
          value={datos.monto}
          ayuda={ayudaDelMonto}
          error={mensaje('monto')}
          onBlur={() => {
            onTocar('monto');
          }}
          onChange={(e) => {
            onCambio({ monto: e.target.value });
          }}
        />
        <AccesoCampoTexto
          etiqueta={t('fecha')}
          type="date"
          mono
          value={datos.fechaPago}
          error={mensaje('fechaPago')}
          onBlur={() => {
            onTocar('fechaPago');
          }}
          onChange={(e) => {
            onCambio({ fechaPago: e.target.value });
          }}
        />
      </div>

      <div className={styles.medio}>
        <span className={styles.etiqueta}>{t('medio')}</span>
        <FiltroSegmentado<MedioDePago>
          etiqueta={t('medio')}
          valor={datos.medio}
          onCambio={(medio) => {
            onCambio({ medio });
          }}
          opciones={MEDIOS.map((m) => ({ valor: m, etiqueta: t(`medios.${m}`) }))}
        />
      </div>

      <AccesoCampoTexto
        etiqueta={t('referencia')}
        mono
        value={datos.referencia}
        ayuda={t('referenciaAyuda')}
        error={mensaje('referencia')}
        autoComplete="off"
        onBlur={() => {
          onTocar('referencia');
        }}
        onChange={(e) => {
          onCambio({ referencia: e.target.value });
        }}
      />
    </div>
  );
}
