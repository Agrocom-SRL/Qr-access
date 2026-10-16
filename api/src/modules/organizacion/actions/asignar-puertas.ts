import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { crearServicioDeUsuarios } from '../../seguridad/contracts.js';
import { RepositorioDeAsignaciones, RepositorioDePuertas } from '../repository.js';

/** Puertas de un usuario: `todas` o una lista de ids de puerta. */
export interface PuertasAsignadas {
  readonly todas: boolean;
  readonly puertaIds: readonly string[];
}

/** Lo que tiene asignado un usuario de la cuenta del contexto (sin asignación: ninguna puerta). */
export async function ver(pool: Pool, usuarioId: string): Promise<PuertasAsignadas> {
  const filas = await new RepositorioDeAsignaciones(pool).deUsuario(usuarioId);
  const todas = filas.some((fila) => fila.puerta_id === null);
  return {
    todas,
    puertaIds: todas
      ? []
      : filas.flatMap((fila) => (fila.puerta_id === null ? [] : [fila.puerta_id])),
  };
}

/**
 * Reemplaza las puertas asignadas a un usuario de la cuenta. Un usuario o una puerta de otra
 * cuenta no existen para esta consulta (404): el aislamiento lo da el repositorio (invariante 1).
 */
export async function reemplazar(
  pool: Pool,
  usuarioId: string,
  deseadas: PuertasAsignadas,
): Promise<void> {
  if (!(await crearServicioDeUsuarios(pool).estaActivo(usuarioId))) {
    throw new ErrorDeDominio('usuario.no_encontrado', 404);
  }
  const ids = deseadas.todas ? [] : [...new Set(deseadas.puertaIds)];
  if (
    ids.length > 0 &&
    (await new RepositorioDePuertas(pool).buscarPorIds(ids)).length !== ids.length
  ) {
    throw new ErrorDeDominio('puerta.no_encontrada', 404);
  }
  const quedan: (string | null)[] = deseadas.todas ? [null] : ids;
  const repositorio = new RepositorioDeAsignaciones(pool);
  const actuales = await repositorio.deUsuario(usuarioId);
  await enTransaccion(pool, async (tx) => {
    for (const fila of actuales) {
      if (!quedan.includes(fila.puerta_id)) await repositorio.quitar(tx, fila.id);
    }
    for (const puertaId of quedan) {
      if (!actuales.some((fila) => fila.puerta_id === puertaId)) {
        await repositorio.asignar(tx, usuarioId, puertaId);
      }
    }
  });
}
