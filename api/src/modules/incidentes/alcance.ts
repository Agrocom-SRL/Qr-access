import type { Pool } from 'mysql2/promise';
import type { PrincipalUsuario } from '../../platform/seguridad/principal.js';
import { crearServicioDeArbol } from '../seguridad/contracts.js';

/**
 * A quiénes llega alguien con los incidentes (ADR 0033 §3, segunda capa sobre el aislamiento por cuenta, ADR 0028 §4):
 * - **Ver:** él y su rama. Vale también para el Administrador: cada Administrador ve solo SU rama, nunca la de otro
 *   Administrador de la misma cuenta (supuesto D-29, a confirmar con Miguel). El Miembro y el Guardia no tienen
 *   rama: solo los propios.
 * - **Resolver y registrar:** lo mismo, pero nunca sobre uno mismo. Un Miembro o un Guardia no tienen el permiso.
 * El permiso (`seguridad.incidente.ver` / `.resolver`) dice si puede hacer la acción; este alcance, sobre quién.
 */
export interface AlcanceDeIncidentes {
  /** Él y su rama; es siempre el límite (no existe un «toda la cuenta»). */
  readonly ids: ReadonlySet<string>;
  readonly usuarioId: string;
}

export async function alcanceDeIncidentes(
  pool: Pool,
  principal: PrincipalUsuario,
): Promise<AlcanceDeIncidentes> {
  const alcance = await crearServicioDeArbol(pool).alcanceDe(principal.usuarioId);
  return { ids: alcance.ids, usuarioId: principal.usuarioId };
}

/** Los usuarios cuyos incidentes se ven. */
export function usuariosVisibles(alcance: AlcanceDeIncidentes): readonly string[] {
  return [...alcance.ids];
}

/** ¿Los incidentes de ese usuario están a la vista? (el repositorio ya filtró por cuenta) */
export function puedeVer(alcance: AlcanceDeIncidentes, usuarioId: string): boolean {
  return alcance.ids.has(usuarioId);
}
