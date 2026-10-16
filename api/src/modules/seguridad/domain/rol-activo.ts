/**
 * Con qué rol arranca una sesión: el único que tenga; si tiene varios, el último que eligió
 * (si aún lo tiene); si no, ninguno y la app le pide elegir (HU-05).
 */
export function decidirRolActivo(
  rolesDelUsuario: readonly string[],
  rolPreferido: string | null,
): string | null {
  if (rolesDelUsuario.length === 1) return rolesDelUsuario[0] ?? null;
  if (rolPreferido !== null && rolesDelUsuario.includes(rolPreferido)) return rolPreferido;
  return null;
}
