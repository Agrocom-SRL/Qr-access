import type { Pool } from 'mysql2/promise';
import { ultimosEventos, type EventoDeBitacora } from '../../bitacora/contracts.js';
import {
  crearServicioDeConteoDeUsuarios,
  crearServicioDeIdentidades,
} from '../../seguridad/contracts.js';
import {
  crearServicioDeSuscripcionesDePlataforma,
  entraEnVentana,
  type EstadoDeSuscripcion,
} from '../../suscripciones/contracts.js';

export interface RenovacionProxima {
  cuenta: { id: string; codigo: string; nombre: string };
  vence_el: string;
  /** Negativo si ya venció. */
  dias_restantes: number;
  monto: number;
  estado: EstadoDeSuscripcion;
}

export interface Resumen {
  actualizado_at: string;
  cuentas: { activas: number; total: number; por_vencer: number };
  usuarios: { en_uso: number; cupo_vendido: number };
  por_vencer_30: { cuentas: number; monto: number };
  ingresos_esperados: { monto: number };
  renovaciones: RenovacionProxima[];
  ultimas_acciones: EventoDeBitacora[];
}

const RENOVACIONES_A_MOSTRAR = 5;

/**
 * El tablero de la plataforma (A02): cuentas y usuarios en uso, lo que vence en 30 días, lo que
 * se espera cobrar en el año, las renovaciones próximas (más la última vencida) y las últimas
 * acciones. Todo sale de los contratos de `seguridad`, `suscripciones` y `bitacora`.
 */
export async function ejecutar(pool: Pool, ahora: Date = new Date()): Promise<Resumen> {
  const cuentas = await crearServicioDeIdentidades(pool).todasLasCuentas();
  const [suscripciones, usuarios, ultimas] = await Promise.all([
    crearServicioDeSuscripcionesDePlataforma(pool).deTodasLasCuentas(ahora),
    crearServicioDeConteoDeUsuarios(pool).activosPorCuenta(cuentas.map((c) => c.id)),
    ultimosEventos(pool, 5),
  ]);

  const filas = cuentas.flatMap((cuenta) => {
    const suscripcion = suscripciones.get(cuenta.id);
    return cuenta.activa && suscripcion !== undefined ? [{ cuenta, suscripcion }] : [];
  });
  const vigentes = filas.filter(({ suscripcion }) =>
    ['activa', 'por_vencer'].includes(suscripcion.estado),
  );
  const en = (ventana: 'd30' | 'vencidas') =>
    filas.filter(({ suscripcion }) =>
      entraEnVentana(
        { estado: suscripcion.estado, diasRestantes: suscripcion.diasRestantes },
        ventana,
      ),
    );

  const aRenovacion = ({ cuenta, suscripcion }: (typeof filas)[number]): RenovacionProxima => ({
    cuenta: { id: cuenta.id, codigo: cuenta.codigo, nombre: cuenta.nombre },
    vence_el: suscripcion.hasta.toISOString(),
    dias_restantes: suscripcion.diasRestantes,
    monto: suscripcion.plan.precioAnual,
    estado: suscripcion.estado,
  });
  const proximas = en('d30').sort(
    (a, b) => a.suscripcion.diasRestantes - b.suscripcion.diasRestantes,
  );
  const ultimaVencida = en('vencidas').sort(
    (a, b) => b.suscripcion.diasRestantes - a.suscripcion.diasRestantes,
  )[0];

  return {
    actualizado_at: ahora.toISOString(),
    cuentas: {
      activas: vigentes.length,
      total: cuentas.length,
      por_vencer: vigentes.filter(({ suscripcion }) => suscripcion.estado === 'por_vencer').length,
    },
    usuarios: {
      en_uso: vigentes.reduce((suma, { cuenta }) => suma + (usuarios.get(cuenta.id) ?? 0), 0),
      cupo_vendido: vigentes.reduce(
        (suma, { suscripcion }) => suma + (suscripcion.plan.cupoUsuarios ?? 0),
        0,
      ),
    },
    por_vencer_30: {
      cuentas: proximas.length,
      monto: proximas.reduce((suma, { suscripcion }) => suma + suscripcion.plan.precioAnual, 0),
    },
    ingresos_esperados: {
      monto: vigentes.reduce((suma, { suscripcion }) => suma + suscripcion.plan.precioAnual, 0),
    },
    renovaciones: [
      ...proximas.slice(0, RENOVACIONES_A_MOSTRAR - (ultimaVencida === undefined ? 0 : 1)),
      ...(ultimaVencida === undefined ? [] : [ultimaVencida]),
    ].map(aRenovacion),
    ultimas_acciones: ultimas,
  };
}
