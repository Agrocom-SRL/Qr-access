import type { Pool } from 'mysql2/promise';
import { aIso, aIsoONulo } from '../../platform/tiempo/fechas.js';
import { crearServicioDeOrganizacion, type PuertaDeCuenta } from '../organizacion/contracts.js';
import { estadoDelQr, type EstadoDeQr } from './domain/estado-qr.js';
import { RepositorioDePuertasDeQr, type QrFila } from './repository.js';

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
