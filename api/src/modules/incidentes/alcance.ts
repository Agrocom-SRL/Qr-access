import type { Pool } from 'mysql2/promise';
import type { PrincipalUsuario } from '../../platform/seguridad/principal.js';
import { crearServicioDeArbol, crearServicioDeUsuarios } from '../seguridad/contracts.js';

/**
 * A quiénes llega alguien con los incidentes (ADR 0033 §3, segunda capa sobre el aislamiento por cuenta, ADR 0028 §4):
 * - **Ver:** el Administrador, a todos los de la cuenta; los demás, los suyos y los de su rama (el Miembro y el
 *   Guardia, solo los propios).
 * - **Resolver y registrar:** nunca sobre uno mismo; el Administrador, sobre cualquier otro usuario de la cuenta; el
 *   Titular, sobre su rama. Un Miembro o un Guardia no tienen el permiso.
 * El permiso (`seguridad.incidente.ver` / `.resolver`) dice si puede hacer la acción; este alcance, sobre quién.
 */
export interface AlcanceDeIncidentes {
  /** `true`: toda la cuenta; `ids` no es el límite. */
  readonly todaLaCuenta: boolean;
  /** Él y su rama. */
  readonly ids: ReadonlySet<string>;
  readonly usuarioId: string;
}

export async function alcanceDeIncidentes(
  pool: Pool,
  principal: PrincipalUsuario,
): Promise<AlcanceDeIncidentes> {
  const alcance = await crearServicioDeArbol(pool).alcanceDe(principal.usuarioId);
  return { todaLaCuenta: alcance.todaLaCuenta, ids: alcance.ids, usuarioId: principal.usuarioId };
}

/** Los usuarios cuyos incidentes se ven; `null` = todos los de la cuenta. */
export function usuariosVisibles(alcance: AlcanceDeIncidentes): readonly string[] | null {
  return alcance.todaLaCuenta ? null : [...alcance.ids];
}

/** ¿Los incidentes de ese usuario están a la vista? (el repositorio ya filtró por cuenta) */
export function puedeVer(alcance: AlcanceDeIncidentes, usuarioId: string): boolean {
  return alcance.todaLaCuenta || alcance.ids.has(usuarioId);
}

/** ¿Puede resolver o registrar incidentes de ese usuario? Nunca el propio. */
export function puedeResolver(alcance: AlcanceDeIncidentes, usuarioId: string): boolean {
  return usuarioId !== alcance.usuarioId && puedeVer(alcance, usuarioId);
}

/** ¿El usuario existe en la cuenta del contexto? (para un Administrador, que no tiene la lista de ids) */
export async function existeEnLaCuenta(pool: Pool, usuarioId: string): Promise<boolean> {
  return (await crearServicioDeUsuarios(pool).etiquetasDe([usuarioId])).has(usuarioId);
}
