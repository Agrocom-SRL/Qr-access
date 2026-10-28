import type { Pool } from 'mysql2/promise';
import { aIso } from '../../platform/tiempo/fechas.js';
import {
  crearServicioDeActividadParaSenales,
  inicioDelMesLocal,
  ZONA_DE_LOS_TOPES,
  diaLocal,
} from '../accesos/contracts.js';
import {
  crearServicioDeBolsaDeCuentas,
  crearServicioDeMarcasDeBolsa,
} from '../limites/contracts.js';
import type { CuentaDePlataforma } from '../seguridad/contracts.js';
import { crearServicioDeSuscripcionesDePlataforma } from '../suscripciones/contracts.js';
import { estadoDeBolsa, porcentajeDeBolsa, type EstadoDeBolsa } from './domain/reglas.js';

/**
 * Cuánto se reutiliza el cálculo de las vistas de plataforma que recorren todas las cuentas (lista de consumo y de
 * flujo): el panel las vuelve a pedir al ordenar, filtrar o paginar y recalcularlas en cada clic cuesta una lectura de
 * todas las cuentas. Son cifras para mirar, no para decidir: unos segundos de atraso no cambian nada (ADR 0030 §5).
 */
export const VIGENCIA_DE_VISTAS_DE_PLATAFORMA_MS = 45_000;

/** El consumo de la bolsa mensual de QR de una cuenta en el mes en curso (ADR 0030 §2 y §5). */
export interface ConsumoDeCuenta {
  readonly cuenta: CuentaDePlataforma;
  /** Nombre del plan vigente de la cuenta; `null` sin suscripción. */
  readonly plan: string | null;
  readonly usado: number;
  /** QR por mes que rigen para la cuenta; `null` si ni el plan ni una excepción ni la general la fijan. */
  readonly tope: number | null;
  readonly porcentaje: number | null;
  readonly estado: EstadoDeBolsa;
  readonly origenDelTope: 'excepcion' | 'plan' | 'general' | null;
  /** Cuándo se marcó el porcentaje de aviso este mes, o `null`. */
  readonly avisoAt: Date | null;
  /** Cuándo se marcó por última vez que se pasó de la bolsa este mes, o `null`. */
  readonly superadaAt: Date | null;
}

export interface ConsumoDelMes {
  /** `aaaa-mm` del mes local en curso. */
  readonly mes: string;
  /** Inicio del mes local (UTC). */
  readonly desde: Date;
  readonly avisoPorcentaje: number;
  readonly consumos: ConsumoDeCuenta[];
}

/**
 * Calcula el consumo del mes en curso de esas cuentas, con lecturas de solo lectura de varios módulos: lo generado
 * (accesos), la bolsa que rige (excepción de la cuenta > plan > general, límites; el plan, suscripciones) y las marcas
 * del mes (límites). La bolsa se cuenta como la cuenta la generación: todos los QR generados desde el 1 del mes local.
 * No escribe nada ni limita nada: es lo que mira AGROCOM.
 */
export async function calcularConsumo(
  pool: Pool,
  cuentas: readonly CuentaDePlataforma[],
  ahora: Date,
): Promise<ConsumoDelMes> {
  const desde = inicioDelMesLocal(ahora, ZONA_DE_LOS_TOPES);
  const hasta = new Date(ahora.getTime() + 1);
  const ids = cuentas.map((cuenta) => cuenta.id);
  const suscripciones =
    await crearServicioDeSuscripcionesDePlataforma(pool).deTodasLasCuentas(ahora);
  const planes = new Map(
    ids.map((id) => [id, suscripciones.get(id)?.plan.bolsaQrMensual ?? null] as const),
  );
  const [usados, bolsas, marcas] = await Promise.all([
    crearServicioDeActividadParaSenales(pool).generadosPorCuenta(ids, desde, hasta),
    crearServicioDeBolsaDeCuentas(pool).de(planes),
    crearServicioDeMarcasDeBolsa(pool).ultimasDelMes(ids, desde),
  ]);
  const consumos = cuentas.map((cuenta): ConsumoDeCuenta => {
    const usado = usados.get(cuenta.id) ?? 0;
    const bolsa = bolsas.bolsas.get(cuenta.id) ?? { tope: null, origen: null };
    return {
      cuenta,
      plan: suscripciones.get(cuenta.id)?.plan.nombre ?? null,
      usado,
      tope: bolsa.tope,
      porcentaje: porcentajeDeBolsa(usado, bolsa.tope),
      estado: estadoDeBolsa(usado, bolsa.tope, bolsas.avisoPorcentaje),
      origenDelTope: bolsa.origen,
      avisoAt: marcas.get(cuenta.id)?.avisoAt ?? null,
      superadaAt: marcas.get(cuenta.id)?.superadaAt ?? null,
    };
  });
  return {
    mes: diaLocal(ahora, ZONA_DE_LOS_TOPES).slice(0, 7),
    desde,
    avisoPorcentaje: bolsas.avisoPorcentaje,
    consumos,
  };
}

/** El consumo de una cuenta como lo devuelve la API (fechas ISO, nombres del contrato). */
export function presentarConsumo(consumo: ConsumoDeCuenta) {
  return {
    cuenta: presentarCuenta(consumo.cuenta),
    plan: consumo.plan,
    usado: consumo.usado,
    tope: consumo.tope,
    porcentaje: consumo.porcentaje,
    estado: consumo.estado,
    origen_del_tope: consumo.origenDelTope,
    aviso_at: consumo.avisoAt === null ? null : aIso(consumo.avisoAt),
    superada_at: consumo.superadaAt === null ? null : aIso(consumo.superadaAt),
  };
}

export function presentarCuenta(cuenta: CuentaDePlataforma) {
  return { id: cuenta.id, codigo: cuenta.codigo, nombre: cuenta.nombre, estado: cuenta.estado };
}

/** ¿El código o el nombre de la cuenta contiene el texto (sin distinguir mayúsculas)? */
export function coincideConLaBusqueda(cuenta: CuentaDePlataforma, buscar: string | null): boolean {
  if (buscar === null) return true;
  const texto = buscar.toLocaleLowerCase('es');
  return (
    cuenta.codigo.toLocaleLowerCase('es').includes(texto) ||
    cuenta.nombre.toLocaleLowerCase('es').includes(texto)
  );
}
