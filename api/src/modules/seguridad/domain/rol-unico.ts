/**
 * Un usuario tiene un solo rol (ADR 0028 §2): ese es el rol de la sesión. Sin rol vigente
 * (p. ej. el rol quedó inactivo) la sesión no tiene permisos. La base impide más de uno
 * (`uq_usuario_roles_usuario`); si apareciera, se falla cerrado y no se elige ninguno.
 */
export function rolUnico(rolesDelUsuario: readonly string[]): string | null {
  return rolesDelUsuario.length === 1 ? (rolesDelUsuario[0] ?? null) : null;
}
