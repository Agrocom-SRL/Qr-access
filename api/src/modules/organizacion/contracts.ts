import type { Pool } from 'mysql2/promise';
import type { Listado, Paginacion } from '../../platform/http/paginacion.js';
import {
  ejecutar as listarPuertasDeLaCuenta,
  type PuertaListada,
} from './actions/listar-puertas.js';
import { RepositorioDePuertas, RepositorioDeSitios, type PuertaFila } from './repository.js';

export type { PuertaListada } from './actions/listar-puertas.js';

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
  /** Cuántos sitios y puertas activos tiene la cuenta del contexto. */
  contarSitiosYPuertas(): Promise<{ sitios: number; puertas: number }>;
  /** Las puertas activas de la cuenta del contexto con su sitio y el estado de su lector. */
  listarPuertasConEstado(paginacion: Paginacion, ahora: Date): Promise<Listado<PuertaListada>>;
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
    async contarSitiosYPuertas() {
      const [sitios, cantidad] = await Promise.all([
        new RepositorioDeSitios(pool).contarActivos(),
        puertas.contarActivas(),
      ]);
      return { sitios, puertas: cantidad };
    },
    listarPuertasConEstado: (paginacion, ahora) => listarPuertasDeLaCuenta(pool, paginacion, ahora),
    async buscarPuertas(ids) {
      return (await puertas.buscarPorIds(ids)).map(aPuerta);
    },
  };
}
