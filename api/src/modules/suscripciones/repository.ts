import type { Pool, RowDataPacket } from 'mysql2/promise';
import { RepositorioDeCuenta } from '../../platform/db/repositorio-de-cuenta.js';

export interface SuscripcionVigenteFila extends RowDataPacket {
  id: string;
  hasta: Date;
  plan_nombre: string;
  max_vigencia_qr_horas: number | null;
  max_usuarios: number | null;
  max_dispositivos: number | null;
}

/** Dueño de `suscripciones` (ADR 0003). `planes` es de plataforma y se une por su id. */
export class RepositorioDeSuscripciones extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'suscripciones',
      columnas: ['plan_id', 'desde', 'hasta', 'estado'],
      perfil: 'dominio',
      deCuenta: true,
    });
  }

  /** La suscripción de la cuenta del contexto que cubre `ahora`, con los límites de su plan. */
  buscarVigente(ahora: Date): Promise<SuscripcionVigenteFila | null> {
    return this.seleccionarUna<SuscripcionVigenteFila>({
      columnas:
        't.id, t.hasta, p.nombre AS plan_nombre, p.max_vigencia_qr_horas, p.max_usuarios, p.max_dispositivos',
      uniones: 'JOIN planes AS p ON p.id = t.plan_id AND p.deleted_at IS NULL AND p.activo = 1',
      donde: "t.estado = 'vigente' AND t.desde <= ? AND t.hasta > ?",
      params: [ahora, ahora],
    });
  }
}
