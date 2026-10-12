import type { Pool } from 'mysql2/promise';
import type { Transaccion } from '../../platform/db/transaccion.js';
import { diasRestantes, estadoDeSuscripcion, type EstadoDeSuscripcion } from './domain/estado.js';
import {
  RepositorioDePlanes,
  RepositorioDeSuscripciones,
  RepositorioDeSuscripcionesDeTodas,
  type SuscripcionActualFila,
} from './repository.js';

export { DIAS_PARA_POR_VENCER, diasRestantes, estadoDeSuscripcion } from './domain/estado.js';
export type { EstadoDeSuscripcion } from './domain/estado.js';

/** Lo que otros módulos pueden saber de la suscripción de una cuenta (ADR 0017). */
export interface SuscripcionVigente {
  readonly id: string;
  readonly hasta: Date;
  readonly planNombre: string;
  /** `null` = el plan no limita la vigencia de un QR. */
  readonly maxVigenciaQrHoras: number | null;
  /** `null` = el plan no limita la cantidad de usuarios (PIN). */
  readonly maxUsuarios: number | null;
  /** `null` = el plan no limita la cantidad de dispositivos. */
  readonly maxDispositivos: number | null;
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
      return {
        id: fila.id,
        hasta: fila.hasta,
        planNombre: fila.plan_nombre,
        maxVigenciaQrHoras: fila.max_vigencia_qr_horas,
        maxUsuarios: fila.max_usuarios,
        maxDispositivos: fila.max_dispositivos,
      };
    },
  };
}

/** El plan contratado por una cuenta, con lo que el panel necesita mostrar. */
export interface PlanContratado {
  readonly id: string;
  readonly nombre: string;
  /** `null` = el plan no limita los usuarios. */
  readonly cupoUsuarios: number | null;
  readonly precioAnual: number;
}

/** La suscripción actual de una cuenta vista desde plataforma (ADR 0017 y 0022). */
export interface SuscripcionDeCuenta {
  readonly id: string;
  readonly cuentaId: string;
  readonly plan: PlanContratado;
  readonly desde: Date;
  readonly hasta: Date;
  readonly estado: EstadoDeSuscripcion;
  /** Negativo si ya venció. */
  readonly diasRestantes: number;
}

function aSuscripcionDeCuenta(fila: SuscripcionActualFila, ahora: Date): SuscripcionDeCuenta {
  return {
    id: fila.id,
    cuentaId: fila.tenant_id,
    plan: {
      id: fila.plan_id,
      nombre: fila.plan_nombre,
      cupoUsuarios: fila.max_usuarios,
      precioAnual: Number(fila.precio_anual),
    },
    desde: fila.desde,
    hasta: fila.hasta,
    estado: estadoDeSuscripcion(fila, ahora),
    diasRestantes: diasRestantes(fila.hasta, ahora),
  };
}

export interface ServicioDeSuscripcionesDePlataforma {
  /** `cuentaId -> su suscripción actual`; una cuenta sin suscripción no figura. */
  deTodasLasCuentas(ahora: Date): Promise<Map<string, SuscripcionDeCuenta>>;
  /** Un plan que se vende (activo), o `null`. */
  buscarPlan(planId: string): Promise<PlanContratado | null>;
  /**
   * Da de alta la suscripción de la cuenta del contexto (HU-01). Se llama dentro de
   * `ContextoCuenta.comoPlataformaEn` y de la transacción que crea la cuenta.
   */
  crear(
    tx: Transaccion,
    suscripcion: { planId: string; desde: Date; hasta: Date },
  ): Promise<string>;
  /** La suscripción actual de la cuenta del contexto, o `null`. */
  deLaCuentaDelContexto(ahora: Date): Promise<SuscripcionDeCuenta | null>;
}

export function crearServicioDeSuscripcionesDePlataforma(
  pool: Pool,
): ServicioDeSuscripcionesDePlataforma {
  return {
    async deTodasLasCuentas(ahora) {
      const mapa = new Map<string, SuscripcionDeCuenta>();
      // Vienen por cuenta y de la más nueva a la más vieja: la primera gana.
      for (const fila of await new RepositorioDeSuscripcionesDeTodas(pool).listar()) {
        if (!mapa.has(fila.tenant_id)) mapa.set(fila.tenant_id, aSuscripcionDeCuenta(fila, ahora));
      }
      return mapa;
    },
    async buscarPlan(planId) {
      const fila = await new RepositorioDePlanes(pool).buscarActivoPorId(planId);
      if (fila === null) return null;
      return {
        id: fila.id,
        nombre: fila.nombre,
        cupoUsuarios: fila.max_usuarios,
        precioAnual: Number(fila.precio_anual),
      };
    },
    crear: (tx, suscripcion) => new RepositorioDeSuscripciones(pool).crear(tx, suscripcion),
    async deLaCuentaDelContexto(ahora) {
      const fila = await new RepositorioDeSuscripciones(pool).buscarActual();
      return fila === null ? null : aSuscripcionDeCuenta(fila, ahora);
    },
  };
}
