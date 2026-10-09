import type { Pool } from 'mysql2/promise';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalDispositivo } from '../../../platform/seguridad/principal.js';
import { crearServicioDeOrganizacion } from '../../organizacion/contracts.js';

export interface ConfiguracionDelDispositivo {
  segundos_apertura: number;
  zona_horaria: string;
  /** Sin OTA en V1 (ADR 0009): el campo existe para no cambiar el contrato después. */
  ota: null;
}

/** Lo que el dispositivo necesita saber de su puerta: la duración del pulso y la hora del sitio. */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalDispositivo,
): Promise<ConfiguracionDelDispositivo> {
  const [puerta] = await crearServicioDeOrganizacion(pool).buscarPuertas([principal.puertaId]);
  if (puerta === undefined) throw new ErrorDeDominio('puerta.no_encontrada', 404);
  return {
    segundos_apertura: puerta.segundosApertura,
    zona_horaria: puerta.zonaHoraria,
    ota: null,
  };
}
