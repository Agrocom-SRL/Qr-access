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

  /** Extiende la vigencia: el nuevo `hasta` ya viene calculado por el dominio. */
  renovar(tx: Transaccion, id: string, hasta: Date): Promise<boolean> {
    return this.actualizar(tx, id, { hasta });
  }

  cambiarPlan(tx: Transaccion, id: string, planId: string): Promise<boolean> {
    return this.actualizar(tx, id, { plan_id: planId });
  }

  /** Suspende o reactiva (`vigente`); el estado `vencida` se calcula, no se guarda. */
  cambiarEstado(tx: Transaccion, id: string, estado: 'vigente' | 'suspendida'): Promise<boolean> {
    return this.actualizar(tx, id, { estado });
  }

  /** La suscripción de la cuenta del contexto que cubre `ahora`, con los límites de su plan. */
  buscarVigente(ahora: Date): Promise<SuscripcionVigenteFila | null> {
    return this.seleccionarUna<SuscripcionVigenteFila>({
      columnas:
        't.id, t.hasta, p.nombre AS plan_nombre, p.max_vigencia_qr_horas, p.max_usuarios, p.max_dispositivos',
      // Un plan retirado de la venta (activo = 0) sigue valiendo para la cuenta que ya lo tiene (ADR 0022).
      uniones: 'JOIN planes AS p ON p.id = t.plan_id',
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

  /** `id -> nombre`, también de planes que ya no se venden (la bitácora los menciona). */
  async nombresPorIds(ids: readonly string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const filas = await this.seleccionar<PlanFila>({
      columnas: 't.id, t.nombre, t.max_usuarios, t.precio_anual',
      donde: 't.id IN (?)',
      params: [ids],
    });
    return new Map(filas.map((fila) => [fila.id, fila.nombre]));
  }

  /** Un plan vigente (no borrado) con ese nombre, activo o retirado: el nombre es único. */
  buscarPorNombre(nombre: string): Promise<PlanFila | null> {
    return this.seleccionarUna<PlanFila>({
      columnas: 't.id, t.nombre, t.max_usuarios, t.precio_anual',
      donde: 't.nombre = ?',
      params: [nombre],
    });
  }

  crear(
    tx: Transaccion,
    plan: { nombre: string; cupoUsuarios: number; precioAnual: number },
  ): Promise<string> {
    return this.insertar(tx, {
      nombre: plan.nombre,
      max_usuarios: plan.cupoUsuarios,
      precio_anual: plan.precioAnual,
      activo: 1,
    });
  }

  editar(
    tx: Transaccion,
    id: string,
    cambios: Readonly<Record<string, unknown>>,
  ): Promise<boolean> {
    return this.actualizar(tx, id, cambios);
  }

  /** Lo saca de la venta sin tocar a las cuentas que lo tienen. */
  retirar(tx: Transaccion, id: string): Promise<boolean> {
    return this.actualizar(tx, id, { activo: 0 });
  }

  /** Soft delete: solo para un plan que ninguna cuenta usa ni usó. */
  eliminar(tx: Transaccion, id: string): Promise<boolean> {
    return this.borrar(tx, id);
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

  /** Cuántas suscripciones (de cuentas activas o no) tienen o tuvieron ese plan. */
  contarDelPlan(planId: string): Promise<number> {
    return this.contar({ donde: 't.plan_id = ?', params: [planId] });
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

export type TipoDePago = 'renovacion' | 'mejora_de_plan';
export type MedioDePago = 'transferencia' | 'deposito' | 'efectivo';

export interface PagoFila extends RowDataPacket {
  id: string;
  tenant_id: string;
  suscripcion_id: string;
  plan_id: string;
  plan_nombre: string;
  tipo: TipoDePago;
  monto: string;
  fecha_pago: Date;
  medio: MedioDePago;
  referencia: string;
  periodo_desde: Date;
  periodo_hasta: Date;
  created_by: string | null;
  created_at: Date;
}

export interface NuevoPago {
  readonly suscripcionId: string;
  readonly planId: string;
  readonly tipo: TipoDePago;
  readonly monto: number;
  /** `aaaa-mm-dd`. */
  readonly fechaPago: string;
  readonly medio: MedioDePago;
  readonly referencia: string;
  readonly periodoDesde: Date;
  readonly periodoHasta: Date;
}

const COLUMNAS_DE_PAGO =
  't.id, t.tenant_id, t.suscripcion_id, t.plan_id, p.nombre AS plan_nombre, t.tipo, t.monto, t.fecha_pago, t.medio, t.referencia, t.periodo_desde, t.periodo_hasta, t.created_by, t.created_at';
const UNION_PLAN_DE_PAGO = 'JOIN planes AS p ON p.id = t.plan_id';

/** Dueño de `pagos`: los de la cuenta del contexto. */
export class RepositorioDePagos extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'pagos',
      columnas: [
        'suscripcion_id',
        'plan_id',
        'tipo',
        'monto',
        'fecha_pago',
        'medio',
        'referencia',
        'periodo_desde',
        'periodo_hasta',
      ],
      perfil: 'dominio',
      deCuenta: true,
    });
  }

  registrar(tx: Transaccion, pago: NuevoPago): Promise<string> {
    return this.insertar(tx, {
      suscripcion_id: pago.suscripcionId,
      plan_id: pago.planId,
      tipo: pago.tipo,
      monto: pago.monto,
      fecha_pago: pago.fechaPago,
      medio: pago.medio,
      referencia: pago.referencia,
      periodo_desde: pago.periodoDesde,
      periodo_hasta: pago.periodoHasta,
    });
  }

  /** Los pagos de la cuenta, el más reciente primero. */
  listar(): Promise<PagoFila[]> {
    return this.seleccionar<PagoFila>({
      columnas: COLUMNAS_DE_PAGO,
      uniones: UNION_PLAN_DE_PAGO,
      orden: 't.fecha_pago DESC, t.id DESC',
    });
  }
}

interface TotalCobradoFila extends RowDataPacket {
  monto: string | null;
  pagos: string | number;
}

/**
 * Cuánto se cobró en un año, de todas las cuentas (cobranza, resumen). Salto EXPLÍCITO del
 * aislamiento: solo lee totales agregados, nunca filas de una cuenta ni escribe.
 */
export class RepositorioDeTotalesDePagos extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, { nombre: 'pagos', columnas: [], perfil: 'dominio', deCuenta: true });
  }

  async cobradoEn(desde: string, hasta: string): Promise<{ monto: number; pagos: number }> {
    const fila = await this.seleccionarUna<TotalCobradoFila>({
      columnas: 'SUM(t.monto) AS monto, COUNT(*) AS pagos',
      donde: 't.fecha_pago >= ? AND t.fecha_pago < ?',
      params: [desde, hasta],
    });
    return { monto: Number(fila?.monto ?? 0), pagos: Number(fila?.pagos ?? 0) };
  }
}
