import { createHmac } from 'node:crypto';
import { generarTokenOpaco, sha256Hex } from '../../../platform/seguridad/tokens.js';

/** Texto del QR: `AQ1.<token>` (ADR 0008). Corto, para que un lector económico lo lea rápido. */
export const PREFIJO_QR = 'AQ1.';
/** 128 bits en base64url ocupan 22 caracteres. */
export const LARGO_DEL_TOKEN = 22;

const TOKEN = /^[A-Za-z0-9_-]{22}$/;

/** Token de 128 bits al azar. No lleva datos de la cuenta, la puerta ni el vencimiento. */
export function generarTokenQr(): string {
  return generarTokenOpaco(16);
}

export function textoDeQr(token: string): string {
  return `${PREFIJO_QR}${token}`;
}

/** El token del texto leído, o `null` si no tiene el prefijo y el largo exactos (paso 1). */
export function extraerToken(texto: string): string | null {
  if (!texto.startsWith(PREFIJO_QR)) return null;
  const token = texto.slice(PREFIJO_QR.length);
  return TOKEN.test(token) ? token : null;
}

/**
 * Lo único que se guarda del token: SHA-256 (índice único). Con 128 bits de entropía no hace
 * falta sal ni argon2, y un volcado de la base no permite reconstruir ningún QR vigente.
 */
export function hashDeToken(token: string): string {
  return sha256Hex(token);
}

/**
 * Token de una generación idempotente: 128 bits derivados con HMAC-SHA256 de la pimienta del servidor, la cuenta,
 * el usuario y la clave de idempotencia (ADR 0031 §11). Existe para que un reintento (la respuesta original se
 * perdió) pueda devolver el MISMO texto sin que el servidor guarde nunca el token, ni en claro ni cifrado
 * (ADR 0008): se vuelve a calcular y su hash coincide con el de `qr_accesos`. Sigue siendo impredecible para
 * quien no tenga la pimienta; la derivación incluye cuenta y usuario, así que dos usuarios con la misma clave
 * obtienen tokens distintos, y el instante de creación hace que reusar una clave ya vencida dé otro token
 * (nunca el hash de un QR anterior).
 */
export function derivarTokenQr(
  pimienta: string,
  cuentaId: string,
  usuarioId: string,
  claveDeIdempotencia: string,
  creadaAt: Date,
): string {
  // Subclave propia del uso: la pimienta del PIN no se usa directamente para otra cosa.
  const subclave = createHmac('sha256', pimienta).update('qr-idempotente-v1').digest();
  return createHmac('sha256', subclave)
    .update(JSON.stringify([cuentaId, usuarioId, claveDeIdempotencia, creadaAt.getTime()]))
    .digest()
    .subarray(0, 16)
    .toString('base64url');
}
