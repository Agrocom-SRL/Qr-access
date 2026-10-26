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

/** Lo mínimo de un usuario que hace falta para armar el árbol de la cuenta. */
export interface NodoDeUsuario {
  readonly id: string;
  readonly etiqueta: string | null;
  readonly superiorId: string | null;
  readonly nivel: NivelDeUsuario | null;
}

export interface RamaDeAdministrador {
  readonly id: string;
  readonly etiqueta: string | null;
  readonly guardias: readonly { id: string; etiqueta: string | null }[];
  readonly titulares: readonly {
    id: string;
    etiqueta: string | null;
    /** Cuántos Miembros cuelgan de este Titular. */
    miembros: number;
  }[];
}

/**
 * El árbol de una cuenta tal como lo ve AGROCOM (ADR 0028 §1): cada Administrador con sus Guardias y
 * sus Titulares, y cuántos Miembros tiene cada Titular. Un usuario cuyo superior no es lo esperado
 * (p. ej. un rol sin nivel) no aparece: el árbol solo muestra lo que cuelga de un Administrador.
 */
export function armarJerarquia(usuarios: readonly NodoDeUsuario[]): RamaDeAdministrador[] {
  const miembrosPorTitular = new Map<string, number>();
  for (const usuario of usuarios) {
    if (usuario.nivel === 'miembro' && usuario.superiorId !== null) {
      miembrosPorTitular.set(
        usuario.superiorId,
        (miembrosPorTitular.get(usuario.superiorId) ?? 0) + 1,
      );
    }
  }
  return usuarios
    .filter((usuario) => usuario.nivel === 'administrador')
    .map((admin) => ({
      id: admin.id,
      etiqueta: admin.etiqueta,
      guardias: usuarios
        .filter((u) => u.nivel === 'guardia' && u.superiorId === admin.id)
        .map((u) => ({ id: u.id, etiqueta: u.etiqueta })),
      titulares: usuarios
        .filter((u) => u.nivel === 'titular' && u.superiorId === admin.id)
        .map((u) => ({
          id: u.id,
          etiqueta: u.etiqueta,
          miembros: miembrosPorTitular.get(u.id) ?? 0,
        })),
    }));
}
