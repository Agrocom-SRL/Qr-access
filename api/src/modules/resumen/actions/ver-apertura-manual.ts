import type { Pool } from 'mysql2/promise';
import { crearServicioDeEstadisticasDeAperturaManual } from '../../accesos/contracts.js';

export interface AperturaManualDelPanel {
  dias: number;
  ordenadas: number;
  rechazadas: number;
  por_qr: number;
  usuarios: number;
  cuentas_que_la_usaron: number;
  ejecucion: { ejecutadas: number; fallidas: number; sin_confirmacion: number };
  por_puerta: {
    cuenta: { id: string; codigo: string; nombre: string };
    puerta: { id: string; nombre: string; sitio: string };
    total: number;
    rechazadas: number;
  }[];
  por_cuenta: {
    cuenta: { id: string; codigo: string; nombre: string };
    total: number;
    rechazadas: number;
    usuarios: number;
  }[];
  por_dia: { dia: string; ordenadas: number; rechazadas: number }[];
  por_hora: { hora: number; total: number }[];
  configuracion: {
    puertas: number;
    habilitadas: number;
    disponibles: number;
    cuentas: number;
    cuentas_con_modo_activo: number;
  };
}

/** La ventana que mira el panel: los últimos 30 días, hoy incluido. */
const DIAS = 30;
/** Cuántas puertas y cuentas se listan: las que más usan la apertura manual. */
const FILAS = 10;
const ZONA = 'America/La_Paz';
/** La Paz no cambia de hora: UTC−4 todo el año. */
const DESFASE_UTC = '-04:00';
const DIA_MS = 86_400_000;

const formatoDeDia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, dateStyle: 'short' });

/** `aaaa-mm-dd` de una fecha en la zona de la plataforma. */
const diaLocal = (fecha: Date): string => formatoDeDia.format(fecha);

/**
 * Las estadísticas de la apertura manual para AGROCOM (ADR 0035, HU-21): cuántas veces se usó, en qué puertas y
 * cuentas, con qué frecuencia (por día y por hora), qué cuentas la tienen activa y cuántas órdenes fallaron. Solo
 * totales de la plataforma: nunca una fila de una cuenta.
 */
export async function ejecutar(
  pool: Pool,
  ahora: Date = new Date(),
): Promise<AperturaManualDelPanel> {
  const hoy = diaLocal(ahora);
  const dias = Array.from({ length: DIAS }, (_, i) =>
    diaLocal(new Date(ahora.getTime() - (DIAS - 1 - i) * DIA_MS)),
  );
  const desde = new Date(`${dias[0] ?? hoy}T00:00:00${DESFASE_UTC}`);
  const hasta = new Date(new Date(`${hoy}T00:00:00${DESFASE_UTC}`).getTime() + DIA_MS);

  const datos = await crearServicioDeEstadisticasDeAperturaManual(pool).estadisticas(
    desde,
    hasta,
    DESFASE_UTC,
    FILAS,
  );
  const deCadaDia = new Map(datos.porDia.map((fila) => [fila.dia, fila]));
  const deCadaHora = new Map(datos.porHora.map((fila) => [fila.hora, fila.total]));
  return {
    dias: DIAS,
    ordenadas: datos.ordenadas,
    rechazadas: datos.rechazadas,
    por_qr: datos.porQr,
    usuarios: datos.usuarios,
    cuentas_que_la_usaron: datos.cuentasQueLaUsaron,
    ejecucion: {
      ejecutadas: datos.ejecucion.ejecutadas,
      fallidas: datos.ejecucion.fallidas,
      sin_confirmacion: datos.ejecucion.sinConfirmacion,
    },
    por_puerta: datos.porPuerta.map((fila) => ({ ...fila, cuenta: { ...fila.cuenta } })),
    por_cuenta: datos.porCuenta.map((fila) => ({ ...fila, cuenta: { ...fila.cuenta } })),
    por_dia: dias.map((dia) => ({
      dia,
      ordenadas: deCadaDia.get(dia)?.ordenadas ?? 0,
      rechazadas: deCadaDia.get(dia)?.rechazadas ?? 0,
    })),
    por_hora: Array.from({ length: 24 }, (_, hora) => ({ hora, total: deCadaHora.get(hora) ?? 0 })),
    configuracion: {
      puertas: datos.configuracion.puertas,
      habilitadas: datos.configuracion.habilitadas,
      disponibles: datos.configuracion.disponibles,
      cuentas: datos.configuracion.cuentas,
      cuentas_con_modo_activo: datos.configuracion.cuentasConModoActivo,
    },
  };
}
