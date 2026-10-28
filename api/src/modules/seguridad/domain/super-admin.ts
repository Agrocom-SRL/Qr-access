/** Reglas puras del equipo AGROCOM (super admin, ADR 0004 §7). */

export const LARGO_MINIMO_DE_CONTRASENA = 10;
export const LARGO_MAXIMO_DE_CONTRASENA = 128;

const USUARIO_ADMITIDO = /^[a-z0-9][a-z0-9._-]{2,59}$/;

/** El usuario se guarda en minúsculas y sin espacios en los extremos; `null` si no tiene forma válida. */
export function normalizarUsername(entrada: string): string | null {
  const usuario = entrada.trim().toLowerCase();
  return USUARIO_ADMITIDO.test(usuario) ? usuario : null;
}

export function contrasenaValida(contrasena: string): boolean {
  return (
    contrasena.length >= LARGO_MINIMO_DE_CONTRASENA &&
    contrasena.length <= LARGO_MAXIMO_DE_CONTRASENA
  );
}

/**
 * Motivo cuando quien desactiva a alguien del equipo no lo escribe (el panel anterior no lo pedía);
 * la base exige uno para todo estado distinto de `activo`. Es un código, no un texto de interfaz.
 */
export const MOTIVO_POR_DEFECTO = 'equipo.desactivado';

export type MotivoDeBloqueo = 'a_si_mismo' | 'ultimo_activo';

/**
 * Un super admin no puede desactivarse a sí mismo y siempre queda al menos uno activo (A11).
 * `activosIds` son los ids activos justo antes de desactivar.
 */
export function motivoParaNoDesactivar(
  actorId: string,
  objetivoId: string,
  activosIds: readonly string[],
): MotivoDeBloqueo | null {
  if (actorId === objetivoId) return 'a_si_mismo';
  const quedarian = activosIds.filter((id) => id !== objetivoId);
  return quedarian.length === 0 ? 'ultimo_activo' : null;
}
