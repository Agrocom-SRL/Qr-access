import type { Pool } from 'mysql2/promise';
import {
  crearServicioDeSuscripcionesDePlataforma,
  entraEnVentana,
  estadoDePago,
  type EstadoDeSuscripcion,
  type EstadoDePago,
  type VentanaDeCobranza,
} from '../../suscripciones/contracts.js';
import { RepositorioDeCuentasDePlataforma } from '../repository.js';

export interface FilaDeCobranza {
  cuenta: { id: string; codigo: string; nombre: string };
  plan: { id: string; nombre: string; cupo_usuarios: number | null };
  /** Lo que se cobra en la renovación: el precio anual vigente del plan. */
  monto: number;
  vence_el: string;
  dias_restantes: number;
  pago: EstadoDePago;
  estado: EstadoDeSuscripcion;
}

export interface Cobranza {
  totales: {
    por_cobrar_30: { monto: number; cuentas: number };
    por_cobrar_90: { monto: number; cuentas: number };
    vencido_sin_pagar: { monto: number; cuentas: number };
    /** Cuentas nuevas que todavía no pagaron su alta. */
    por_activar: { monto: number; cuentas: number };
    cobrado_anio: { anio: number; monto: number; pagos: number };
  };
  conteos: Record<VentanaDeCobranza, number>;
  datos: FilaDeCobranza[];
}

const VENTANAS: readonly VentanaDeCobranza[] = ['d30', 'd60', 'd90', 'vencidas', 'pendientes'];

function normalizar(texto: string): string {
  return texto.normalize('NFD').replaceAll(/\p{M}/gu, '').toLowerCase().trim();
}

/** Cobranza (A08): cuánto hay por cobrar por ventana de vencimiento y la lista de la ventana elegida. */
export async function ejecutar(
  pool: Pool,
  consulta: { ventana: VentanaDeCobranza; busqueda: string },
  ahora: Date = new Date(),
): Promise<Cobranza> {
  const servicio = crearServicioDeSuscripcionesDePlataforma(pool);
  const anio = Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric' }).format(ahora),
  );
  const [cuentas, suscripciones, cobrado] = await Promise.all([
    new RepositorioDeCuentasDePlataforma(pool).listarTodas(),
    servicio.deTodasLasCuentas(ahora),
    servicio.cobradoEnElAnio(anio),
  ]);

  const filas: FilaDeCobranza[] = cuentas.flatMap((cuenta) => {
    const suscripcion = suscripciones.get(cuenta.id);
    if (suscripcion === undefined || cuenta.activo !== 1) return [];
    return [
      {
        cuenta: { id: cuenta.id, codigo: cuenta.codigo, nombre: cuenta.nombre },
        plan: {
          id: suscripcion.plan.id,
          nombre: suscripcion.plan.nombre,
          cupo_usuarios: suscripcion.plan.cupoUsuarios,
        },
        monto: suscripcion.plan.precioAnual,
        vence_el: suscripcion.hasta.toISOString(),
        dias_restantes: suscripcion.diasRestantes,
        pago: estadoDePago(suscripcion.estado),
        estado: suscripcion.estado,
      },
    ];
  });

  const en = (ventana: VentanaDeCobranza) =>
    filas.filter((f) =>
      entraEnVentana({ estado: f.estado, diasRestantes: f.dias_restantes }, ventana),
    );
  const total = (lista: FilaDeCobranza[]) => ({
    monto: lista.reduce((suma, f) => suma + f.monto, 0),
    cuentas: lista.length,
  });
  const buscado = normalizar(consulta.busqueda);

  return {
    totales: {
      por_cobrar_30: total(en('d30')),
      por_cobrar_90: total(en('d90')),
      vencido_sin_pagar: total(en('vencidas')),
      por_activar: total(en('pendientes')),
      cobrado_anio: { anio, ...cobrado },
    },
    conteos: Object.fromEntries(VENTANAS.map((v) => [v, en(v).length])) as Record<
      VentanaDeCobranza,
      number
    >,
    datos: en(consulta.ventana)
      .filter(
        (f) =>
          buscado === '' ||
          normalizar(f.cuenta.nombre).includes(buscado) ||
          normalizar(f.cuenta.codigo).includes(buscado),
      )
      .sort((a, b) => a.dias_restantes - b.dias_restantes),
  };
}
