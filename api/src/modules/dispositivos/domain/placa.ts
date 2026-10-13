import { randomInt } from 'node:crypto';

/** Crockford base32: sin I, L, O ni U para que el código impreso no se confunda al teclearlo. */
const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const LARGO_DEL_CODIGO = 16;
const MAC = /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/;

/**
 * Código de vinculación de una placa (ADR 0025): 16 caracteres de un alfabeto de 32, o sea
 * 80 bits. Es el secreto que prueba que quien reclama es la placa y no alguien que conoce su
 * MAC; se muestra una sola vez y en la base solo queda su hash (invariante 6).
 */
export function generarCodigoDeVinculacion(): string {
  let codigo = '';
  for (let i = 0; i < LARGO_DEL_CODIGO; i += 1)
    codigo += ALFABETO.charAt(randomInt(ALFABETO.length));
  return codigo;
}

/** La MAC en mayúsculas y con `:` (`aa-bb-…` también vale), o `null` si no es una MAC. */
export function normalizarMac(texto: string): string | null {
  const mac = texto.trim().toUpperCase().replaceAll('-', ':');
  return MAC.test(mac) ? mac : null;
}

/** El código tal como lo teclea una persona: sin espacios ni guiones, en mayúsculas. */
export function normalizarCodigo(texto: string): string {
  return texto.replaceAll(/[\s-]/g, '').toUpperCase();
}
