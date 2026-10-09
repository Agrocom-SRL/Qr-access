import type { Pool } from 'mysql2/promise';
import { RepositorioDePuertas, type PuertaFila } from './repository.js';

/** Lo que otros módulos pueden saber de una puerta (accesos, dispositivos). */
export interface PuertaDeCuenta {
  readonly id: string;
  readonly nombre: string;
  readonly sitioId: string;
  readonly sitioNombre: string;
  /** Zona IANA del sitio, en la que se evalúa el fin del día (invariante 7). */
  readonly zonaHoraria: string;
  readonly segundosApertura: number;
  readonly activa: boolean;
}

export interface ServicioDeOrganizacion {
  /** Puertas de la cuenta del contexto. Un id inexistente o de otra cuenta simplemente no vuelve. */
  buscarPuertas(ids: readonly string[]): Promise<PuertaDeCuenta[]>;
}

function aPuerta(fila: PuertaFila): PuertaDeCuenta {
  return {
    id: fila.id,
    nombre: fila.nombre,
    sitioId: fila.sitio_id,
    sitioNombre: fila.sitio_nombre,
    zonaHoraria: fila.zona_horaria,
    segundosApertura: fila.segundos_apertura,
    activa: fila.activo === 1,
  };
}

export function crearServicioDeOrganizacion(pool: Pool): ServicioDeOrganizacion {
  const puertas = new RepositorioDePuertas(pool);
  return {
    async buscarPuertas(ids) {
      return (await puertas.buscarPorIds(ids)).map(aPuerta);
    },
  };
}
