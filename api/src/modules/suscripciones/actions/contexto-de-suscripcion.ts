import type { Pool } from 'mysql2/promise';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { SuscripcionActualFila } from '../repository.js';
import { RepositorioDeSuscripciones } from '../repository.js';

/**
 * La suscripción actual de la cuenta del contexto o 404: sin ella no hay cuenta que administrar
 * (el repositorio filtra por la cuenta del contexto, así que una cuenta inexistente tampoco la tiene).
 */
export async function suscripcionActualODeLaCuenta(pool: Pool): Promise<SuscripcionActualFila> {
  const fila = await new RepositorioDeSuscripciones(pool).buscarActual();
  if (fila === null) throw new ErrorDeDominio('suscripcion.no_encontrada', 404);
  return fila;
}
