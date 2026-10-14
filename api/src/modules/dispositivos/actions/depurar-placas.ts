import type { Pool } from 'mysql2/promise';
import { RepositorioDePlacas } from '../placas-repository.js';

/** Cuánto sin anunciarse hace que una placa libre salga del inventario (ADR 0026 §6). */
export const DIAS_SIN_CONTACTO = 7;

/**
 * Da de baja las placas sin dispositivo en servicio que dejaron de anunciarse: el anuncio es
 * anónimo y cualquiera puede inventar MAC. Una placa real que vuelve a anunciarse reaparece sola.
 */
export function ejecutar(pool: Pool, ahora: Date = new Date()): Promise<number> {
  const antes = new Date(ahora.getTime() - DIAS_SIN_CONTACTO * 24 * 3_600_000);
  return new RepositorioDePlacas(pool).depurarSinContacto(antes, ahora);
}
