import { useTranslation } from 'react-i18next';
import { AccesoBadge, type TonoBadge } from '../../../../shared/ui/atoms/AccesoBadge';
import type { NombreIcono } from '../../../../shared/ui/atoms/iconos';
import type { Placa } from '../../domain/placa';
import styles from './SaludDePlaca.module.css';

interface Insignia {
  clave: string;
  tono: TonoBadge;
  icono: NombreIcono;
}

/**
 * Lo que el último latido dice del lector y del sensor, y las aperturas que fallan. Cada dato es
 * un texto con su ícono (nunca solo color). Es diagnóstico: no decide nada (ADR 0031 §18).
 */
export function insigniasDeSalud(placa: Placa): Insignia[] {
  const insignias: Insignia[] = [];
  if (placa.lectorResponde === true) {
    insignias.push({ clave: 'lectorResponde', tono: 'primario', icono: 'qr_code_scanner' });
  } else if (placa.lectorResponde === false) {
    insignias.push({ clave: 'lectorSinRespuesta', tono: 'peligro', icono: 'error' });
  }
  if (placa.estado === 'vinculada') {
    if (placa.sensorConfigurado?.instalado === true && placa.sensorPuerta !== null) {
      if (placa.sensorPuerta === 'abierta') {
        insignias.push({ clave: 'sensorAbierta', tono: 'informacion', icono: 'door_front' });
      } else if (placa.sensorPuerta === 'cerrada') {
        insignias.push({ clave: 'sensorCerrada', tono: 'informacion', icono: 'door_front' });
      } else {
        insignias.push({ clave: 'sinSensor', tono: 'neutro', icono: 'sensors_off' });
      }
    } else {
      insignias.push({ clave: 'sinSensor', tono: 'neutro', icono: 'sensors_off' });
    }
  }
  if (placa.aperturaFallida) {
    insignias.push({ clave: 'aperturaFallida', tono: 'peligro', icono: 'block' });
  }
  if (placa.enObservacion) {
    insignias.push({ clave: 'observacion', tono: 'neutro', icono: 'visibility' });
  }
  return insignias;
}

export function SaludDePlaca({ placa }: { placa: Placa }) {
  const { t } = useTranslation('placas');
  const insignias = insigniasDeSalud(placa);
  if (insignias.length === 0) return <span className={styles.suave}>—</span>;
  return (
    <span className={styles.salud}>
      {insignias.map((i) => (
        <AccesoBadge key={i.clave} tono={i.tono} icono={i.icono}>
          {t(`salud.${i.clave}`)}
        </AccesoBadge>
      ))}
    </span>
  );
}
