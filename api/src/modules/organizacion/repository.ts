import type { Pool, RowDataPacket } from 'mysql2/promise';
import { RepositorioDeCuenta } from '../../platform/db/repositorio-de-cuenta.js';

export interface PuertaFila extends RowDataPacket {
  id: string;
  nombre: string;
  segundos_apertura: number;
  activo: number;
  sitio_id: string;
  sitio_nombre: string;
  zona_horaria: string;
}

const COLUMNAS =
  't.id, t.nombre, t.segundos_apertura, t.activo, s.id AS sitio_id, s.nombre AS sitio_nombre, s.zona_horaria';
/** El sitio es de la misma cuenta que la puerta: se une también por `tenant_id`. */
const UNION_SITIO =
  'JOIN sitios AS s ON s.id = t.sitio_id AND s.tenant_id = t.tenant_id AND s.deleted_at IS NULL';

/** Dueño de `puertas` (y de `sitios`, que por ahora solo se leen unidos a una puerta). */
export class RepositorioDePuertas extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'puertas',
      columnas: ['sitio_id', 'nombre', 'segundos_apertura', 'activo'],
      perfil: 'dominio',
      deCuenta: true,
    });
  }

  listarActivas(limite: number, desplazamiento: number): Promise<PuertaFila[]> {
    return this.seleccionar<PuertaFila>({
      columnas: COLUMNAS,
      uniones: UNION_SITIO,
      donde: 't.activo = 1 AND s.activo = 1',
      orden: 's.nombre, t.nombre, t.id',
      limite,
      desplazamiento,
    });
  }

  contarActivas(): Promise<number> {
    return this.contar({ uniones: UNION_SITIO, donde: 't.activo = 1 AND s.activo = 1' });
  }

  /** Las puertas de la cuenta del contexto con esos ids; las que no existan o sean de otra cuenta no vuelven. */
  buscarPorIds(ids: readonly string[]): Promise<PuertaFila[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.seleccionar<PuertaFila>({
      columnas: COLUMNAS,
      uniones: UNION_SITIO,
      donde: 't.id IN (?)',
      params: [ids],
    });
  }
}
