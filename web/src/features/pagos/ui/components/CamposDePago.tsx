import { useTranslation } from 'react-i18next';
import { AccesoSelector } from '../../../../shared/ui/molecules/AccesoSelector';
import { AccesoCampoTexto } from '../../../../shared/ui/molecules/AccesoCampoTexto';
import { CampoMonto } from '../../../../shared/ui/molecules/CampoMonto';
import { FiltroSegmentado } from '../../../../shared/ui/molecules/FiltroSegmentado';
import {
  BANCOS,
  MEDIOS,
  requiereRespaldo,
  type ErrorDePago,
  type FormularioDePago,
  type MedioDePago,
} from '../../domain/pago';
import { CampoComprobante } from './CampoComprobante';
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
    if (campo === 'monto' && error === 'formato') return t('montoInvalido');
    return t(error);
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

      {requiereRespaldo(datos.medio) ? (
        <>
          <div className={styles.fila}>
            <AccesoSelector
              etiqueta={t('banco')}
              value={datos.banco}
              error={mensaje('banco')}
              opciones={[
                { valor: '', etiqueta: t('bancoElegir') },
                ...BANCOS.map((banco) => ({ valor: banco, etiqueta: banco })),
              ]}
              onBlur={() => {
                onTocar('banco');
              }}
              onChange={(e) => {
                onCambio({ banco: e.target.value });
              }}
            />
            <AccesoCampoTexto
              etiqueta={t('cuentaDestino')}
              mono
              value={datos.cuentaDestino}
              ayuda={t('cuentaDestinoAyuda')}
              error={mensaje('cuentaDestino')}
              autoComplete="off"
              onBlur={() => {
                onTocar('cuentaDestino');
              }}
              onChange={(e) => {
                onCambio({ cuentaDestino: e.target.value });
              }}
            />
          </div>
          <CampoComprobante
            archivo={datos.comprobante}
            error={mensaje('comprobante')}
            onCambio={(comprobante) => {
              onCambio({ comprobante });
            }}
            onBlur={() => {
              onTocar('comprobante');
            }}
          />
        </>
      ) : null}
    </div>
  );
}
