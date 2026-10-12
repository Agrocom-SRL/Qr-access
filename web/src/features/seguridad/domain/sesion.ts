/** Tipos y reglas puras de la sesión del super admin (ADR 0004 §7). */

export interface UsuarioSesion {
  id: string;
  nombre: string;
  usuario: string;
}

export interface SesionIniciada {
  usuario: UsuarioSesion;
  /** Contraseña fijada por otro super admin: hay que cambiarla antes de seguir. */
  debeCambiarContrasena: boolean;
  permisos: readonly string[];
}

export interface PerfilAdmin extends UsuarioSesion {
  creadoEn: Date;
  ultimoIngresoEn: Date | null;
  debeCambiarContrasena: boolean;
  permisos: readonly string[];
}

export function tienePermiso(permisos: readonly string[], codigo: string): boolean {
  return permisos.includes(codigo);
}
