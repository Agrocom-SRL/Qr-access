import type { Pool } from 'mysql2/promise';
import {
  armarListado,
  limiteDe,
  type Listado,
  type Paginacion,
} from '../../../platform/http/paginacion.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { alcanceDeIncidentes, usuariosVisibles } from '../alcance.js';
import type { EstadoDeIncidente, OrigenDeIncidente, TipoDeIncidente } from '../domain/incidente.js';
import { presentarIncidentes, type IncidenteDeUso } from '../presentacion.js';
import { RepositorioDeIncidentes } from '../repository.js';

export interface FiltrosDeIncidentes {
  readonly usuarioId: string | null;
  readonly tipo: TipoDeIncidente | null;
  readonly origen: OrigenDeIncidente | null;
  readonly estado: EstadoDeIncidente | null;
}

/**
 * Los incidentes de uso que el usuario puede ver (ADR 0033 §3): el Administrador, todos los de la cuenta; el
 * Titular, los de sus Miembros y los suyos; el Miembro y el Guardia, los propios. Del más reciente al más antiguo.
 * Un `usuario_id` fuera de su alcance no devuelve nada.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  filtros: FiltrosDeIncidentes,
  paginacion: Paginacion,
): Promise<Listado<IncidenteDeUso>> {
  const alcance = await alcanceDeIncidentes(pool, principal);
  const filtro = { usuarioIds: usuariosVisibles(alcance), ...filtros };
  const { limite, desplazamiento } = limiteDe(paginacion);
  const repositorio = new RepositorioDeIncidentes(pool);
  const [filas, total] = await Promise.all([
    repositorio.listar(filtro, limite, desplazamiento),
    repositorio.contarFiltrados(filtro),
  ]);
  return armarListado(await presentarIncidentes(pool, filas), paginacion, total);
}
