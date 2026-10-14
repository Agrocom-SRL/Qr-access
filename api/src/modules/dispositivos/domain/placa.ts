import { createHash } from 'node:crypto';

const MAC = /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/;

/** La MAC en mayúsculas y con `:` (`aa-bb-…` también vale), o `null` si no es una MAC. */
export function normalizarMac(texto: string): string | null {
  const mac = texto.trim().toUpperCase().replaceAll('-', ':');
  return MAC.test(mac) ? mac : null;
}

/**
 * Huella de la clave que propone una placa (ADR 0026): SHA-256 en hexadecimal. La clave son
 * 256 bits aleatorios, así que el hash rápido no se puede adivinar; sirve para reconocer al
 * candidato en cada anuncio sin gastar un argon2id en una ruta anónima. La clave definitiva se
 * guarda con argon2id en el dispositivo (invariante 6).
 */
export function huellaDeClave(clave: string): string {
  return createHash('sha256').update(clave).digest('hex');
}
