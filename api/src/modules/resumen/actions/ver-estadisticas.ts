import type { Pool } from 'mysql2/promise';
import { crearServicioDeAccesosDePlataforma } from '../../accesos/contracts.js';
import { crearServicioDeIdentidades } from '../../seguridad/contracts.js';
import {
  crearServicioDeSuscripcionesDePlataforma,
  type EstadoDeSuscripcion,
} from '../../suscripciones/contracts.js';

export interface Estadisticas {
  /** Últimos 12 meses, de más viejo a más nuevo, con ceros donde no hubo pagos. */
  cobrado_por_mes: { mes: string; monto: number; pagos: number }[];
  /** Cuentas nuevas por mes, mismos 12 meses. */
  altas_por_mes: { mes: string; cuentas: number }[];
  cuentas_por_estado: Record<EstadoDeSuscripcion, number>;
  /** Cuántas cuentas y usuarios en uso tiene cada plan contratado. */
  cuentas_por_plan: { plan: string; cuentas: number; cupo_usuarios: number | null }[];
  /** Últimos 14 días (hoy incluido), con ceros donde no hubo intentos. */
  accesos_por_dia: {
    dia: string;
    permitidos: number;
    rechazados: number;
    /** Aperturas repetidas por respuesta perdida (ADR 0032 §3); no suman a `permitidos`. */
    repeticiones_permitidas: number;
    repeticiones_rechazadas: number;
  }[];
}

const MESES = 12;
const DIAS = 14;
const ZONA = 'America/La_Paz';
/** La Paz no cambia de hora: UTC−4 todo el año. */
const DESFASE_UTC = '-04:00';
const DIA_MS = 86_400_000;

const formatoDeDia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, dateStyle: 'short' });

/** `aaaa-mm-dd` de una fecha en la zona de la plataforma. */
function diaLocal(fecha: Date): string {
  return formatoDeDia.format(fecha);
}

/** Los `cantidad` meses que terminan en el de `ahora`, como `aaaa-mm`. */
function ultimosMeses(ahora: Date, cantidad: number): string[] {
  const [anio = 0, mes = 1] = diaLocal(ahora).split('-').map(Number);
  return Array.from({ length: cantidad }, (_, i) => {
    const desfase = cantidad - 1 - i;
    const fecha = new Date(Date.UTC(anio, mes - 1 - desfase, 1));
    return `${String(fecha.getUTCFullYear())}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

/**
 * Las series de las gráficas del Resumen y de Cobranza: lo cobrado y las altas por mes, cómo se
 * reparten las cuentas por estado y por plan, y los accesos de los últimos días. Todo sale de los
 * contratos de `seguridad`, `suscripciones` y `accesos`.
 */
export async function ejecutar(pool: Pool, ahora: Date = new Date()): Promise<Estadisticas> {
  const meses = ultimosMeses(ahora, MESES);
  const primerMes = meses[0] ?? '';
  const [anioFin = 0, mesFin = 1] = (meses.at(-1) ?? '').split('-').map(Number);
  const hastaMeses = `${String(mesFin === 12 ? anioFin + 1 : anioFin)}-${String(mesFin === 12 ? 1 : mesFin + 1).padStart(2, '0')}-01`;

  const hoy = diaLocal(ahora);
  const dias = Array.from({ length: DIAS }, (_, i) =>
    diaLocal(new Date(ahora.getTime() - (DIAS - 1 - i) * DIA_MS)),
  );
  const desdeDias = new Date(`${dias[0] ?? hoy}T00:00:00${DESFASE_UTC}`);
  const hastaDias = new Date(new Date(`${hoy}T00:00:00${DESFASE_UTC}`).getTime() + DIA_MS);

  const suscripciones = crearServicioDeSuscripcionesDePlataforma(pool);
  const [cuentas, porSuscripcion, cobrado, accesos] = await Promise.all([
    crearServicioDeIdentidades(pool).todasLasCuentas(),
    suscripciones.deTodasLasCuentas(ahora),
    suscripciones.cobradoPorMes(`${primerMes}-01`, hastaMeses),
    crearServicioDeAccesosDePlataforma(pool).porDia(desdeDias, hastaDias, DESFASE_UTC),
  ]);

  const activas = cuentas.filter((cuenta) => cuenta.activa);
  const cobradoDe = new Map(cobrado.map((fila) => [fila.mes, fila]));
  const altasDe = new Map<string, number>();
  for (const cuenta of cuentas) {
    const mes = diaLocal(cuenta.clienteDesde).slice(0, 7);
    altasDe.set(mes, (altasDe.get(mes) ?? 0) + 1);
  }
  const accesosDe = new Map(accesos.map((fila) => [fila.dia, fila]));

  const porEstado: Record<EstadoDeSuscripcion, number> = {
    activa: 0,
    por_vencer: 0,
    vencida: 0,
    suspendida: 0,
    pendiente_pago: 0,
  };
  const porPlan = new Map<string, { cuentas: number; cupo: number | null }>();
  for (const cuenta of activas) {
    const suscripcion = porSuscripcion.get(cuenta.id);
    if (suscripcion === undefined) continue;
    porEstado[suscripcion.estado] += 1;
    const plan = porPlan.get(suscripcion.plan.nombre) ?? {
      cuentas: 0,
      cupo: suscripcion.plan.cupoUsuarios,
    };
    plan.cuentas += 1;
    porPlan.set(suscripcion.plan.nombre, plan);
  }

  return {
    cobrado_por_mes: meses.map((mes) => ({
      mes,
      monto: cobradoDe.get(mes)?.monto ?? 0,
      pagos: cobradoDe.get(mes)?.pagos ?? 0,
    })),
    altas_por_mes: meses.map((mes) => ({ mes, cuentas: altasDe.get(mes) ?? 0 })),
    cuentas_por_estado: porEstado,
    cuentas_por_plan: [...porPlan.entries()]
      .map(([plan, datos]) => ({ plan, cuentas: datos.cuentas, cupo_usuarios: datos.cupo }))
      .sort((a, b) => (a.cupo_usuarios ?? Infinity) - (b.cupo_usuarios ?? Infinity)),
    accesos_por_dia: dias.map((dia) => ({
      dia,
      permitidos: accesosDe.get(dia)?.permitidos ?? 0,
      rechazados: accesosDe.get(dia)?.rechazados ?? 0,
      repeticiones_permitidas: accesosDe.get(dia)?.repeticionesPermitidas ?? 0,
      repeticiones_rechazadas: accesosDe.get(dia)?.repeticionesRechazadas ?? 0,
    })),
  };
}
