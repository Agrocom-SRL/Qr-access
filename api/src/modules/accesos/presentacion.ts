import type { Pool } from 'mysql2/promise';
import { aIso, aIsoONulo } from '../../platform/tiempo/fechas.js';
import { crearServicioDeOrganizacion, type PuertaDeCuenta } from '../organizacion/contracts.js';
import { filaEfectiva, type Ejecucion } from './domain/confirmacion.js';
import { estadoDelQr, type EstadoDeQr } from './domain/estado-qr.js';
import {
  RepositorioDeConfirmaciones,
  RepositorioDePuertasDeQr,
  type ConfirmacionFila,
  type QrFila,
} from './repository.js';

export interface QrListado {
  id: string;
  etiqueta: string | null;
  estado: EstadoDeQr;
  vence_at: string;
  usado_at: string | null;
  anulado_at: string | null;
  created_at: string;
  puertas: { id: string; nombre: string }[];
}

/** `id -> puerta` de las puertas pedidas, vía el contrato de organización (nunca su SQL). */
export async function puertasPorId(
  pool: Pool,
  ids: readonly string[],
): Promise<Map<string, PuertaDeCuenta>> {
  const unicos = [...new Set(ids)];
  const puertas = await crearServicioDeOrganizacion(pool).buscarPuertas(unicos);
  return new Map(puertas.map((puerta) => [puerta.id, puerta]));
}

/** Arma los QR con su estado derivado y sus puertas. */
export async function presentarQr(
  pool: Pool,
  filas: readonly QrFila[],
  ahora: Date,
): Promise<QrListado[]> {
  const puertasPorQr = await new RepositorioDePuertasDeQr(pool).puertasDe(
    filas.map((fila) => fila.id),
  );
  const puertas = await puertasPorId(pool, [...puertasPorQr.values()].flat());
  return filas.map((fila) => ({
    id: fila.id,
    etiqueta: fila.etiqueta,
    estado: estadoDelQr(
      { anuladoAt: fila.anulado_at, usadoAt: fila.usado_at, venceAt: fila.vence_at },
      ahora,
    ),
    vence_at: aIso(fila.vence_at),
    usado_at: aIsoONulo(fila.usado_at),
    anulado_at: aIsoONulo(fila.anulado_at),
    created_at: aIso(fila.created_at),
    puertas: (puertasPorQr.get(fila.id) ?? []).map((id) => ({
      id,
      nombre: puertas.get(id)?.nombre ?? '',
    })),
  }));
}

/** Agrupa las filas de confirmación por evento, de la más vieja a la más nueva. */
export function confirmacionesPorEvento(
  filas: readonly ConfirmacionFila[],
): Map<string, ConfirmacionFila[]> {
  const porEvento = new Map<string, ConfirmacionFila[]>();
  for (const fila of filas) {
    porEvento.set(fila.evento_acceso_id, [...(porEvento.get(fila.evento_acceso_id) ?? []), fila]);
  }
  return porEvento;
}

/**
 * `evento -> qué pasó con la orden de abrir` (ADR 0031 §18). Un evento sin fila no figura: es un rechazo (no hubo
 * orden), una apertura que aún espera el informe de la placa o una puerta sin sensor cuya placa no informa.
 */
export async function ejecucionesPorEvento(
  pool: Pool,
  eventoIds: readonly string[],
): Promise<Map<string, Ejecucion>> {
  const filas = await new RepositorioDeConfirmaciones(pool).deEventos(eventoIds);
  return ejecucionesDe(filas);
}

export function ejecucionesDe(filas: readonly ConfirmacionFila[]): Map<string, Ejecucion> {
  const ejecuciones = new Map<string, Ejecucion>();
  for (const [eventoId, deUnEvento] of confirmacionesPorEvento(filas)) {
    const efectiva = filaEfectiva(deUnEvento);
    if (efectiva !== null) ejecuciones.set(eventoId, efectiva.resultado);
  }
  return ejecuciones;
}
