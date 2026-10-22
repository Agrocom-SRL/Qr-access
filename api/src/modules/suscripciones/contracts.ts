import type { Pool } from 'mysql2/promise';
import type { Transaccion } from '../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../platform/errores/error-de-dominio.js';
import { diasRestantes, estadoDeSuscripcion, type EstadoDeSuscripcion } from './domain/estado.js';
import {
  RepositorioDeComprobantes,
  RepositorioDePagos,
  RepositorioDePlanes,
  RepositorioDeTotalesDePagos,
  RepositorioDeSuscripciones,
  RepositorioDeSuscripcionesDeTodas,
  type SuscripcionActualFila,
} from './repository.js';

export { DIAS_PARA_POR_VENCER, diasRestantes, estadoDeSuscripcion } from './domain/estado.js';
export {
  entraEnVentana,
  estadoDePago,
  type EstadoDePago,
  type VentanaDeCobranza,
} from './domain/cobranza.js';
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
  /** `planId -> nombre` de esos planes (vendibles o no), para rotular la bitácora. */
  nombresDePlanes(ids: readonly string[]): Promise<Map<string, string>>;
  /** Un plan que se vende (activo), o `null`. */
  buscarPlan(planId: string): Promise<PlanContratado | null>;
  /**
   * Da de alta la suscripción de la cuenta del contexto (HU-01). Se llama dentro de
   * `ContextoCuenta.comoPlataformaEn` y de la transacción que crea la cuenta. Con `pago`, queda
   * vigente y registra el pago de alta; sin él, queda pendiente de su primer pago.
   */
  crear(
    tx: Transaccion,
    suscripcion: { planId: string; desde: Date; hasta: Date; pago?: PagoDeAlta },
  ): Promise<string>;
  /** La suscripción actual de la cuenta del contexto, o `null`. */
  deLaCuentaDelContexto(ahora: Date): Promise<SuscripcionDeCuenta | null>;
  /** Los pagos de la cuenta del contexto, el más reciente primero. */
  pagosDeLaCuentaDelContexto(): Promise<PagoRegistrado[]>;
  /** Lo cobrado por mes (`aaaa-mm`) entre dos fechas `aaaa-mm-dd` (hasta excluida), de todas las cuentas. */
  cobradoPorMes(
    desde: string,
    hasta: string,
  ): Promise<{ mes: string; monto: number; pagos: number }[]>;
  /** Total cobrado y cantidad de pagos con `fecha_pago` en el año calendario `anio` (todas las cuentas). */
  cobradoEnElAnio(anio: number): Promise<{ monto: number; pagos: number }>;
}

/** El primer pago de una cuenta nueva, registrado junto con su alta. */
export interface PagoDeAlta {
  readonly monto: number;
  /** `aaaa-mm-dd`. */
  readonly fechaPago: string;
  readonly medio: 'transferencia' | 'qr' | 'efectivo';
  readonly referencia: string;
  readonly comprobanteId?: string | undefined;
}

/** Un pago ya registrado de una cuenta. */
export interface PagoRegistrado {
  readonly id: string;
  readonly tipo: 'alta' | 'renovacion' | 'mejora_de_plan';
  readonly planNombre: string;
  readonly monto: number;
  /** `aaaa-mm-dd`. */
  readonly fechaPago: string;
  readonly medio: 'transferencia' | 'qr' | 'efectivo';
  readonly referencia: string;
  readonly banco: string | null;
  readonly cuentaDestino: string | null;
  readonly comprobanteId: string | null;
  readonly periodoDesde: Date;
  readonly periodoHasta: Date;
  /** Id del super admin que lo registró (para mostrar su nombre). */
  readonly registradoPor: string | null;
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
    async nombresDePlanes(ids) {
      return new RepositorioDePlanes(pool).nombresPorIds(ids);
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
    async crear(tx, suscripcion) {
      const { pago, ...datos } = suscripcion;
      const id = await new RepositorioDeSuscripciones(pool).crear(tx, {
        ...datos,
        estado: pago === undefined ? 'pendiente' : 'vigente',
      });
      if (pago !== undefined) {
        if (pago.comprobanteId !== undefined) {
          const comprobante = await new RepositorioDeComprobantes(pool).buscarPorId(
            pago.comprobanteId,
          );
          if (comprobante === null) throw new ErrorDeDominio('comprobante.no_encontrado', 422);
        }
        await new RepositorioDePagos(pool).registrar(tx, {
          suscripcionId: id,
          planId: suscripcion.planId,
          tipo: 'alta',
          monto: pago.monto,
          fechaPago: pago.fechaPago,
          medio: pago.medio,
          referencia: pago.referencia,
          comprobanteId: pago.comprobanteId,
          periodoDesde: suscripcion.desde,
          periodoHasta: suscripcion.hasta,
        });
      }
      return id;
    },
    async pagosDeLaCuentaDelContexto() {
      return (await new RepositorioDePagos(pool).listar()).map((fila) => ({
        id: fila.id,
        tipo: fila.tipo,
        planNombre: fila.plan_nombre,
        monto: Number(fila.monto),
        fechaPago: fechaIso(fila.fecha_pago),
        medio: fila.medio,
        referencia: fila.referencia,
        banco: fila.banco,
        cuentaDestino: fila.cuenta_destino,
        comprobanteId: fila.comprobante_id,
        periodoDesde: fila.periodo_desde,
        periodoHasta: fila.periodo_hasta,
        registradoPor: fila.created_by,
      }));
    },
    cobradoPorMes: (desde, hasta) =>
      new RepositorioDeTotalesDePagos(pool).cobradoPorMes(desde, hasta),
    cobradoEnElAnio: (anio) =>
      new RepositorioDeTotalesDePagos(pool).cobradoEn(
        `${String(anio)}-01-01`,
        `${String(anio + 1)}-01-01`,
      ),
    async deLaCuentaDelContexto(ahora) {
      const fila = await new RepositorioDeSuscripciones(pool).buscarActual();
      return fila === null ? null : aSuscripcionDeCuenta(fila, ahora);
    },
  };
}

/** `DATE` llega como medianoche UTC (el pool usa `timezone: 'Z'`): se lee como `aaaa-mm-dd`. */
function fechaIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}
