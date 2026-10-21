/**
 * Árbol de usuarios de una cuenta (ADR 0028 §1): Administrador → Titular y Guardia → Miembro.
 * El nivel de un usuario sale del nombre de su único rol base; un rol con otro nombre no tiene
 * nivel y, por tanto, no crea a nadie (falla cerrado).
 */
export type NivelDeUsuario = 'administrador' | 'titular' | 'miembro' | 'guardia';

const NIVEL_POR_ROL: Readonly<Record<string, NivelDeUsuario>> = {
  Administrador: 'administrador',
  Titular: 'titular',
  Miembro: 'miembro',
  Guardia: 'guardia',
};

/** Qué niveles crea cada uno (ADR 0028 §3): solo el de abajo, nunca un igual ni uno superior. */
const NIVELES_QUE_CREA: Readonly<Record<NivelDeUsuario, readonly NivelDeUsuario[]>> = {
  administrador: ['titular', 'guardia'],
  titular: ['miembro'],
  miembro: [],
  guardia: [],
};

export function nivelDeRol(nombreDelRol: string): NivelDeUsuario | null {
  return NIVEL_POR_ROL[nombreDelRol] ?? null;
}

/** `true` si `actor` puede crear usuarios de nivel `creado`. Cualquier nivel desconocido: no. */
export function puedeCrear(actor: NivelDeUsuario | null, creado: NivelDeUsuario | null): boolean {
  if (actor === null || creado === null) return false;
  return NIVELES_QUE_CREA[actor].includes(creado);
}
