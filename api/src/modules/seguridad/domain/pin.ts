import { randomInt } from 'node:crypto';
import { hmacHex } from '../../../platform/seguridad/tokens.js';

export interface PinNormalizado {
  /** Las 3 letras de `cuentas.codigo`. */
  readonly codigoDeCuenta: string;
  /** Los 4 caracteres al azar. */
  readonly sufijo: string;
  /** Los 7 caracteres: lo que se hashea con argon2id. */
  readonly completo: string;
}

const ENTRADA_ADMITIDA = /^[A-Za-z0-9\s]+$/;
const FORMATO = /^([A-Z]{3})([A-Z0-9]{4})$/;
const ALFABETO_DEL_SUFIJO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Normaliza lo que escribió el usuario (ADR 0018): sin espacios y en mayúsculas. Devuelve
 * `null` si no tiene la forma de un PIN. Se valida la entrada ANTES de subir a mayúsculas:
 * `toUpperCase` convierte algunas letras raras (`ı`, `ſ`) en ASCII y daría PIN equivalentes.
 */
export function normalizarPin(entrada: string): PinNormalizado | null {
  if (!ENTRADA_ADMITIDA.test(entrada)) return null;
  const completo = entrada.replace(/\s+/g, '').toUpperCase();
  const partes = FORMATO.exec(completo);
  if (partes?.[1] === undefined || partes[2] === undefined) return null;
  return { codigoDeCuenta: partes[1], sufijo: partes[2], completo };
}

/**
 * Índice para encontrar al usuario sin recorrer los de la cuenta: HMAC con la pimienta del
 * entorno sobre `cuenta | sufijo`. Dos cuentas con el mismo sufijo dan índices distintos.
 */
export function calcularIndiceDePin(pimienta: string, cuentaId: string, sufijo: string): string {
  return hmacHex(pimienta, `${cuentaId}|${sufijo}`);
}

/** Sufijo de 4 caracteres con `crypto.randomInt`, carácter por carácter (36⁴ combinaciones). */
export function generarSufijoDePin(): string {
  let sufijo = '';
  for (let i = 0; i < 4; i += 1) {
    sufijo += ALFABETO_DEL_SUFIJO.charAt(randomInt(ALFABETO_DEL_SUFIJO.length));
  }
  return sufijo;
}
