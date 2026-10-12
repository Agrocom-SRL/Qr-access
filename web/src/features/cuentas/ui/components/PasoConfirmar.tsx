import { useTranslation } from 'react-i18next';
import { formatearFecha, formatearMonto } from '../../../../l10n/formatos';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { FilaClaveValor } from '../../../../shared/ui/molecules/FilaClaveValor';
import { FormularioSecciones } from '../../../../shared/ui/organisms/FormularioSecciones';
import { venceUnAnioDespues, type BorradorDeCuenta } from '../../domain/alta';

interface Props {
  borrador: BorradorDeCuenta;
  /** El plan elegido, con su precio vigente (lo que se va a contratar). */
  plan: { cupoUsuarios: number | null; precioAnual: number };
  /** Vuelve al paso `0` (empresa), `1` (plan) o `2` (vigencia y administrador). */
  onEditar: (paso: number) => void;
}

/** A04d: resumen de todo lo capturado, con "Editar" por sección, antes de crear la cuenta. */
export function PasoConfirmar({ borrador, plan, onEditar }: Props) {
  const { t } = useTranslation('crearCuenta');
  const { empresa, vigencia } = borrador;
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
          id: 'resumen-admin',
          titulo: t('secciones.administrador'),
          accion: editar(2),
          contenido: (
            <dl>
              <FilaClaveValor clave={t('nombreEtiqueta')}>
                {vigencia.administradorNombre}
              </FilaClaveValor>
            </dl>
          ),
        },
      ]}
    />
  );
}
