import { createHash, createHmac, randomBytes } from 'node:crypto';

/** Token opaco de `bytes` bytes al azar, en base64url (refresh tokens, claves de dispositivo, QR). */
export function generarTokenOpaco(bytes: number): string {
  return randomBytes(bytes).toString('base64url');
}

/** SHA-256 en hex: para tokens de alta entropía (refresh, QR), donde no hace falta sal ni argon2. */
export function sha256Hex(texto: string): string {
  return createHash('sha256').update(texto).digest('hex');
}

/** HMAC-SHA256 en hex con una pimienta que vive en el entorno, nunca en la base (ADR 0018). */
export function hmacHex(pimienta: string, mensaje: string): string {
  return createHmac('sha256', pimienta).update(mensaje).digest('hex');
}
