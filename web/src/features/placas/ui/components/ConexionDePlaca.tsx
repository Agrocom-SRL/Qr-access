import { useTranslation } from 'react-i18next';
import { AccesoBadge, type TonoBadge } from '../../../../shared/ui/atoms/AccesoBadge';
import type { NombreIcono } from '../../../../shared/ui/atoms/iconos';
import type { EstadoDeConexion } from '../../domain/placa';

/** Tono, ícono y clave de cada estado de conexión: el texto siempre acompaña al color. */
const ESTILO: Readonly<
  Record<EstadoDeConexion, { tono: TonoBadge; icono: NombreIcono; clave: string }>
> = {
  en_linea: { tono: 'primario', icono: 'wifi', clave: 'enLinea' },
  sin_conexion: { tono: 'advertencia', icono: 'wifi_off', clave: 'sinConexion' },
  caida_sostenida: { tono: 'peligro', icono: 'wifi_off', clave: 'caidaSostenida' },
  desaparecida: { tono: 'peligro', icono: 'report', clave: 'desaparecida' },
};

/** Si la placa reporta, cuánto hace que no lo hace (ADR 0031 §18). */
export function ConexionDePlaca({ estado }: { estado: EstadoDeConexion }) {
  const { t } = useTranslation('placas');
  const { tono, icono, clave } = ESTILO[estado];
  return (
    <AccesoBadge tono={tono} icono={icono}>
      {t(`conexion.${clave}`)}
    </AccesoBadge>
  );
}
