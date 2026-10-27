import type { Pool } from 'mysql2/promise';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { alcanceDeIncidentes, puedeVer } from '../alcance.js';
import {
  presentarHistorial,
  presentarIncidentes,
  type IncidenteDeUso,
  type ResolucionDeIncidente,
} from '../presentacion.js';
import { RepositorioDeIncidentes, RepositorioDeResoluciones } from '../repository.js';

export interface IncidenteDetallado extends IncidenteDeUso {
  /** Todas las decisiones sobre el incidente, de la primera a la última. */
  readonly historial: ResolucionDeIncidente[];
}

/** Arma el detalle de un incidente ya leído (el mismo del GET y de lo que devuelve resolver). */
export async function detallar(pool: Pool, id: string): Promise<IncidenteDetallado> {
  const fila = await new RepositorioDeIncidentes(pool).buscarPorId(id);
  if (fila === null) throw new ErrorDeDominio('incidente.no_encontrado', 404);
  const [[incidente], historial] = await Promise.all([
    presentarIncidentes(pool, [fila]),
    new RepositorioDeResoluciones(pool).historial(id),
  ]);
  if (incidente === undefined) throw new ErrorDeDominio('incidente.no_encontrado', 404);
  return { ...incidente, historial: await presentarHistorial(pool, historial) };
}

/**
 * Un incidente con su historial de resoluciones. Uno de otra cuenta, o de alguien fuera del alcance de quien pregunta
 * (el Titular no ve el de otro Titular), no existe: 404 `incidente.no_encontrado`.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  id: string,
): Promise<IncidenteDetallado> {
  const fila = await new RepositorioDeIncidentes(pool).buscarPorId(id);
  const alcance = await alcanceDeIncidentes(pool, principal);
  if (fila === null || !puedeVer(alcance, fila.usuario_id)) {
    throw new ErrorDeDominio('incidente.no_encontrado', 404);
  }
  return detallar(pool, id);
}
