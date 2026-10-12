import type { Pool, RowDataPacket } from 'mysql2/promise';
import { RepositorioDeCuenta } from '../../platform/db/repositorio-de-cuenta.js';
import { RepositorioDePlataforma } from '../../platform/db/repositorio-de-plataforma.js';
import type { Transaccion } from '../../platform/db/transaccion.js';

export interface SuscripcionVigenteFila extends RowDataPacket {
  id: string;
  hasta: Date;
  plan_nombre: string;
  max_vigencia_qr_horas: number | null;
  max_usuarios: number | null;
  max_dispositivos: number | null;
}

export interface SuscripcionActualFila extends RowDataPacket {
  id: string;
  tenant_id: string;
  plan_id: string;
  plan_nombre: string;
  max_usuarios: number | null;
  precio_anual: string;
  desde: Date;
  hasta: Date;
  estado: 'vigente' | 'suspendida' | 'vencida';
}

export interface NuevaSuscripcion {
  readonly planId: string;
  readonly desde: Date;
  readonly hasta: Date;
}

const COLUMNAS_ACTUAL =
  't.id, t.tenant_id, t.plan_id, p.nombre AS plan_nombre, p.max_usuarios, p.precio_anual, t.desde, t.hasta, t.estado';
const UNION_PLAN = 'JOIN planes AS p ON p.id = t.plan_id';

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

  /** La suscripción actual de la cuenta del contexto (vigente, suspendida o vencida): una por cuenta. */
  buscarActual(): Promise<SuscripcionActualFila | null> {
    return this.seleccionarUna<SuscripcionActualFila>({
      columnas: COLUMNAS_ACTUAL,
      uniones: UNION_PLAN,
      orden: 't.id DESC',
    });
  }

  /** Alta de la suscripción de la cuenta del contexto (HU-01); queda `vigente` entre `desde` y `hasta`. */
  crear(tx: Transaccion, suscripcion: NuevaSuscripcion): Promise<string> {
    return this.insertar(tx, {
      plan_id: suscripcion.planId,
      desde: suscripcion.desde,
      hasta: suscripcion.hasta,
      estado: 'vigente',
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

export interface PlanFila extends RowDataPacket {
  id: string;
  nombre: string;
  max_usuarios: number | null;
  precio_anual: string;
}

/** Dueño de `planes` (catálogo de plataforma, sin cuenta). */
export class RepositorioDePlanes extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'planes',
      columnas: [
        'nombre',
        'max_dispositivos',
        'max_usuarios',
        'max_vigencia_qr_horas',
        'precio_anual',
        'activo',
      ],
      perfil: 'dominio',
      deCuenta: false,
    });
  }

  /** Los planes que se venden, del cupo más chico al más grande. */
  listarActivos(): Promise<PlanFila[]> {
    return this.seleccionar<PlanFila>({
      columnas: 't.id, t.nombre, t.max_usuarios, t.precio_anual',
      donde: 't.activo = 1',
      orden: 't.max_usuarios, t.id',
    });
  }

  buscarActivoPorId(id: string): Promise<PlanFila | null> {
    return this.seleccionarUna<PlanFila>({
      columnas: 't.id, t.nombre, t.max_usuarios, t.precio_anual',
      donde: 't.id = ? AND t.activo = 1',
      params: [id],
    });
  }

  /** Solo cambia el precio de las renovaciones y mejoras futuras; las suscripciones vigentes no se tocan. */
  cambiarPrecio(tx: Transaccion, id: string, precioAnual: number): Promise<boolean> {
    return this.actualizar(tx, id, { precio_anual: precioAnual });
  }
}

interface UsoDePlanFila extends RowDataPacket {
  plan_id: string;
  tenant_id: string;
}

/**
 * Qué cuentas usan cada plan, para la pantalla de Planes. Salto EXPLÍCITO del aislamiento
 * (RepositorioDePlataforma sobre `suscripciones`): solo lee pares plan–cuenta, nunca escribe.
 */
export class RepositorioDeUsoDePlanes extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'suscripciones',
      columnas: [],
      perfil: 'dominio',
      deCuenta: true,
    });
  }

  /** `planId -> ids de las cuentas activas` con una suscripción en ese plan. */
  async cuentasPorPlan(): Promise<Map<string, string[]>> {
    const filas = await this.seleccionar<UsoDePlanFila>({
      columnas: 't.plan_id, t.tenant_id',
      uniones: 'JOIN cuentas AS c ON c.id = t.tenant_id AND c.deleted_at IS NULL AND c.activo = 1',
    });
    const mapa = new Map<string, string[]>();
    for (const fila of filas)
      mapa.set(fila.plan_id, [...(mapa.get(fila.plan_id) ?? []), fila.tenant_id]);
    return mapa;
  }
}

/**
 * La suscripción actual de TODAS las cuentas, para el panel de plataforma (lista de cuentas,
 * resumen, cobranza). Salto EXPLÍCITO del aislamiento: solo lee, nunca escribe.
 */
export class RepositorioDeSuscripcionesDeTodas extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'suscripciones',
      columnas: [],
      perfil: 'dominio',
      deCuenta: true,
    });
  }

  listar(): Promise<SuscripcionActualFila[]> {
    return this.seleccionar<SuscripcionActualFila>({
      columnas: COLUMNAS_ACTUAL,
      uniones: UNION_PLAN,
      orden: 't.tenant_id, t.id DESC',
    });
  }
}
