import type { Pool } from 'mysql2/promise';
import { ejecutar as listarBitacora, type EventoDeBitacora } from './actions/listar-bitacora.js';

export type { EventoDeBitacora } from './actions/listar-bitacora.js';
export { esquemaEventoDeBitacora } from './schemas.js';

/** Los últimos `cantidad` cambios relevantes de la plataforma (el Resumen los muestra). */
export async function ultimosEventos(pool: Pool, cantidad: number): Promise<EventoDeBitacora[]> {
  return (await listarBitacora(pool, {}, { pagina: 1, por_pagina: cantidad })).datos;
}
