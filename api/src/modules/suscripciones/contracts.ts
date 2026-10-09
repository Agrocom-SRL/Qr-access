import type { Pool } from 'mysql2/promise';
import { RepositorioDeSuscripciones } from './repository.js';

/** Lo que otros módulos pueden saber de la suscripción de una cuenta (ADR 0017). */
export interface SuscripcionVigente {
  readonly id: string;
  readonly hasta: Date;
  /** `null` = el plan no limita la vigencia de un QR. */
  readonly maxVigenciaQrHoras: number | null;
}

export interface ServicioDeSuscripciones {
  /** La suscripción vigente de la cuenta del contexto, o `null` si no tiene (o venció). */
  obtenerVigente(ahora: Date): Promise<SuscripcionVigente | null>;
}

export function crearServicioDeSuscripciones(pool: Pool): ServicioDeSuscripciones {
  const repositorio = new RepositorioDeSuscripciones(pool);
  return {
    async obtenerVigente(ahora) {
      const fila = await repositorio.buscarVigente(ahora);
      if (fila === null) return null;
      return { id: fila.id, hasta: fila.hasta, maxVigenciaQrHoras: fila.max_vigencia_qr_horas };
    },
  };
}
