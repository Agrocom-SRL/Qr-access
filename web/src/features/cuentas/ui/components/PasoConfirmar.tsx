import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatearFecha, formatearMonto } from '../../../../l10n/formatos';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { FilaClaveValor } from '../../../../shared/ui/molecules/FilaClaveValor';
import { FormularioSecciones } from '../../../../shared/ui/organisms/FormularioSecciones';
import { formatearNumero } from '../../../../l10n/formatos';
import { FiltroSegmentado } from '../../../../shared/ui/molecules/FiltroSegmentado';
import { CamposDePago, type FormularioDePago } from '../../../pagos';
import {
  validarPagoDeAlta,
  venceUnAnioDespues,
  type BorradorDeCuenta,
  type DatosDePagoDeAlta,
} from '../../domain/alta';
import styles from './PasoConfirmar.module.css';

interface Props {
  borrador: BorradorDeCuenta;
  /** El plan elegido, con su precio vigente (lo que se va a contratar). */
  plan: { cupoUsuarios: number | null; precioAnual: number };
  /** Vuelve al paso `0` (empresa), `1` (plan) o `2` (vigencia y administrador). */
  onEditar: (paso: number) => void;
  onPago: (pago: DatosDePagoDeAlta) => void;
}

/** A04d: resumen de todo lo capturado, con "Editar" por sección, antes de crear la cuenta. */
export function PasoConfirmar({ borrador, plan, onEditar, onPago }: Props) {
  const { t } = useTranslation('crearCuenta');
  const { empresa, vigencia, pago } = borrador;
  const [tocados, setTocados] = useState<ReadonlySet<keyof FormularioDePago>>(new Set());
  const datosDePago: FormularioDePago = pago;
  const fecha = (iso: string) => formatearFecha(`${iso}T12:00:00Z`);
  const editar = (paso: number) => (
    <AccesoBoton
      variante="texto"
      onClick={() => {
        onEditar(paso);
      }}
    >
      {t('editar')}
    </AccesoBoton>
  );
  return (
    <FormularioSecciones
      secciones={[
        {
          id: 'resumen-empresa',
          titulo: t('secciones.empresa'),
          accion: editar(0),
          contenido: (
            <dl>
              <FilaClaveValor clave={t('razonSocial')}>{empresa.razonSocial}</FilaClaveValor>
              <FilaClaveValor clave={t('codigoNit')}>
                <TextoMono fuerte>
                  {empresa.codigo} · {empresa.nit}
                </TextoMono>
              </FilaClaveValor>
              <FilaClaveValor clave={t('ciudad')}>{empresa.ciudad}</FilaClaveValor>
              <FilaClaveValor clave={t('responsableTitulo')}>
                {empresa.contactoNombre} · {empresa.contactoCorreo}
              </FilaClaveValor>
            </dl>
          ),
        },
        {
          id: 'resumen-plan',
          titulo: t('secciones.planVigencia'),
          accion: editar(1),
          contenido: (
            <dl>
              <FilaClaveValor clave={t('plan')}>
                {t('hasta')} {t('usuarios', { count: plan.cupoUsuarios ?? 0 })} ·{' '}
                {t('qrIlimitados')}
              </FilaClaveValor>
              <FilaClaveValor clave={t('precioAnual')}>
                <TextoMono>{formatearMonto(plan.precioAnual)}</TextoMono>
              </FilaClaveValor>
              <FilaClaveValor clave={t('vigencia')}>
                <TextoMono>
                  {fecha(vigencia.inicio)} – {fecha(venceUnAnioDespues(vigencia.inicio))}
                </TextoMono>
              </FilaClaveValor>
            </dl>
          ),
        },
        {
          id: 'pago-inicial',
          titulo: t('pagoTitulo'),
          descripcion: t('pagoAyuda'),
          contenido: (
            <div className={styles.pago}>
              <FiltroSegmentado<DatosDePagoDeAlta['modo']>
                etiqueta={t('pagoTitulo')}
                valor={pago.modo}
                onCambio={(modo) => {
                  onPago({
                    ...pago,
                    modo,
                    monto:
                      modo === 'ahora' && pago.monto === ''
                        ? formatearNumero(plan.precioAnual)
                        : pago.monto,
                  });
                }}
                opciones={[
                  { valor: 'despues', etiqueta: t('pagoDespues') },
                  { valor: 'ahora', etiqueta: t('pagoAhora') },
                ]}
              />
              {pago.modo === 'despues' ? (
                <p className={styles.nota}>{t('pagoDespuesTexto')}</p>
              ) : (
                <CamposDePago
                  datos={datosDePago}
                  errores={validarPagoDeAlta(pago)}
                  tocados={tocados}
                  onCambio={(parcial) => {
                    onPago({ ...pago, ...parcial });
                  }}
                  onTocar={(campo) => {
                    setTocados((actual) => new Set(actual).add(campo));
                  }}
                />
              )}
            </div>
          ),
        },
        {
          id: 'resumen-admin',
          titulo: t('secciones.administrador'),
          accion: editar(2),
          contenido: (
            <dl>
              <FilaClaveValor clave={t('nombreAdministrador')}>
                {vigencia.adminIgualAlResponsable
                  ? empresa.contactoNombre
                  : vigencia.administradorNombre}
              </FilaClaveValor>
            </dl>
          ),
        },
      ]}
    />
  );
}
