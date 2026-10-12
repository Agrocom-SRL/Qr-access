/** Reglas de la contraseña del panel; espejo de `api/src/modules/seguridad/domain/super-admin.ts`. */
export const LARGO_MINIMO_DE_CONTRASENA = 10;
export const LARGO_MAXIMO_DE_CONTRASENA = 128;

export type ErrorDeContrasena = 'requerido' | 'corta' | 'noCoinciden' | 'igualAlActual';

export interface CambioDeContrasena {
  actual: string;
  nueva: string;
  repetida: string;
}

/**
 * Valida el formulario de cambio de contraseña antes de llamar a la API (que repite la
 * validación: la autoridad es siempre el servidor). Devuelve el error por campo.
 */
export function validarCambioDeContrasena(
  cambio: CambioDeContrasena,
): Partial<Record<keyof CambioDeContrasena, ErrorDeContrasena>> {
  const errores: Partial<Record<keyof CambioDeContrasena, ErrorDeContrasena>> = {};
  if (cambio.actual === '') errores.actual = 'requerido';
  if (cambio.nueva === '') errores.nueva = 'requerido';
  else if (cambio.nueva.length < LARGO_MINIMO_DE_CONTRASENA) errores.nueva = 'corta';
  else if (cambio.nueva === cambio.actual) errores.nueva = 'igualAlActual';
  if (cambio.repetida !== cambio.nueva) errores.repetida = 'noCoinciden';
  return errores;
}
