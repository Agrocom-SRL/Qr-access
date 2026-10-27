import type { Pool } from 'mysql2/promise';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalDispositivo } from '../../../platform/seguridad/principal.js';
import { RepositorioDeDispositivos } from '../repository.js';
import { crearServicioDeOrganizacion } from '../../organizacion/contracts.js';

export interface ConfiguracionDelDispositivo {
  segundos_apertura: number;
  zona_horaria: string;
  /** Sin OTA en V1 (ADR 0009): el campo existe para no cambiar el contrato después. */
  ota: null;
  /** El sensor de puerta: si está instalado y a qué nivel lee «abierta» (ADR 0031 §18). */
  sensor_puerta: { instalado: boolean; nivel_abierto: 'alto' | 'bajo' };
  /** Cuánto espera la placa ver abrir la puerta tras el pulso antes de informar `fallida`. */
  espera_confirmacion_segundos: number;
}

/** Margen, sobre la duración del pulso, que la placa espera al sensor antes de dar la apertura por fallida. */
export const MARGEN_DE_CONFIRMACION_SEGUNDOS = 5;

/** Lo que el dispositivo necesita saber de su puerta: la duración del pulso y la hora del sitio. */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalDispositivo,
): Promise<ConfiguracionDelDispositivo> {
  const [puerta] = await crearServicioDeOrganizacion(pool).buscarPuertas([principal.puertaId]);
  if (puerta === undefined) throw new ErrorDeDominio('puerta.no_encontrada', 404);
  // Sin la fila, la placa sigue sin sensor (la falla segura es no inventar un éxito ni una falla).
  const sensor = await new RepositorioDeDispositivos(pool).leerSensorConfigurado(
    principal.dispositivoId,
  );
  return {
    segundos_apertura: puerta.segundosApertura,
    zona_horaria: puerta.zonaHoraria,
    ota: null,
    sensor_puerta: {
      instalado: sensor?.sensor_instalado === 1,
      nivel_abierto: sensor?.sensor_abierto_nivel ?? 'alto',
    },
    espera_confirmacion_segundos: puerta.segundosApertura + MARGEN_DE_CONFIRMACION_SEGUNDOS,
  };
}
