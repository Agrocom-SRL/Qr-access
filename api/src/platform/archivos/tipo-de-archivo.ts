export type TipoMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

export const TIPOS_DE_COMPROBANTE: readonly TipoMime[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export const EXTENSION_DE: Readonly<Record<TipoMime, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const empieza = (bytes: Buffer, firma: readonly number[], desde = 0): boolean =>
  firma.every((valor, i) => bytes[desde + i] === valor);

/**
 * El tipo REAL del archivo según sus primeros bytes (ADR 0024): ni la extensión ni el
 * `Content-Type` que declara el cliente son de fiar. `null` si no es ninguno de los permitidos.
 */
export function detectarTipo(bytes: Buffer): TipoMime | null {
  if (empieza(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (empieza(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  // WebP: "RIFF" <tamaño de 4 bytes> "WEBP"
  if (empieza(bytes, [0x52, 0x49, 0x46, 0x46]) && empieza(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'image/webp';
  }
  if (empieza(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  return null;
}
