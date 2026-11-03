import { createHash } from 'node:crypto';

/**
 * `ETag` de un cuerpo JSON: SHA-256 de su serialización (entre comillas, como exige HTTP). Mismo cuerpo, mismo ETag;
 * cualquier cambio de un campo lo cambia. Vale porque el cuerpo se arma siempre con el mismo orden de campos.
 */
export function etagDe(cuerpo: unknown): string {
  return `"${createHash('sha256').update(JSON.stringify(cuerpo)).digest('hex').slice(0, 32)}"`;
}

/**
 * ¿Algún valor de `If-None-Match` es este ETag (o `*`)? Compara en débil, como pide HTTP para GET: ignora el
 * prefijo `W/`.
 */
export function coincideConElEtag(cabecera: string | undefined, etag: string): boolean {
  if (cabecera === undefined) return false;
  return cabecera
    .split(',')
    .map((valor) => valor.trim().replace(/^W\//, ''))
    .some((valor) => valor === '*' || valor === etag);
}
