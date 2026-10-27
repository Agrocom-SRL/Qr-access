import { createHmac } from 'node:crypto';
import { sha256Hex } from '../../../platform/seguridad/tokens.js';

/**
 * Cuánto se recuerda una clave de idempotencia (ADR 0031 §11, «vencimiento corto»). Cubre de sobra los reintentos
 * de una app con mala red (la app descarta la clave al recibir la respuesta); pasado el lapso, la misma clave se
 * trata como una solicitud nueva. Supuesto: el ADR no fija la cifra; 24 h es el estándar de la industria.
 */
export const VIGENCIA_DE_CLAVE_DE_IDEMPOTENCIA_HORAS = 24;

/**
 * Largo mínimo y máximo de la clave que manda la app. 22 caracteres en base64url son 128 bits (lo que mide un
 * UUID v4 sin guiones, y la app manda uno de 36): una clave más corta sería adivinable y, como de ella se
 * deriva el token del QR (ADR 0031 §11), quien la adivine podría repetir la generación de otro.
 */
export const LARGO_MINIMO_DE_CLAVE = 22;
export const LARGO_MAXIMO_DE_CLAVE = 128;

/** Caracteres que admite la clave: los del base64url, que incluyen los de un UUID (hex y guiones). */
export const FORMATO_DE_CLAVE = /^[A-Za-z0-9_-]+$/;

/** Operación a la que pertenece una clave (una misma clave puede repetirse entre operaciones distintas). */
export type OperacionIdempotente = 'qr.generar';

/**
 * Lo único que se guarda de la clave: su HMAC-SHA256 con una subclave propia de `QR_IDEMPOTENCIA_CLAVE`. No es un
 * SHA-256 plano: con un volcado de la base no se puede probar claves candidatas sin el secreto del servidor, y la
 * subclave separa este uso del de la derivación del token (ADR 0031 §11). Rotar el secreto cambia el hash: las
 * claves aún vigentes dejan de reconocerse y un reintento con ellas se trata como una solicitud nueva.
 */
export function hashDeClave(secreto: string, clave: string): string {
  const subclave = createHmac('sha256', secreto).update('qr-idempotencia-clave-v1').digest();
  return createHmac('sha256', subclave).update(clave).digest('hex');
}

/** Lo que define «el mismo cuerpo» de una generación; el orden de las puertas no importa. */
export interface SolicitudDeGeneracion {
  readonly puertaIds: readonly string[];
  readonly venceAt: Date | null;
  readonly etiqueta: string | null;
  readonly propio: boolean;
  readonly reemplazar: boolean;
}

/**
 * Huella del cuerpo normalizado: SHA-256 de un JSON canónico (puertas sin repetir y ordenadas, fechas en UTC).
 * Misma clave con otra huella es un uso indebido de la clave: `idempotencia.conflicto`.
 */
export function huellaDeGeneracion(solicitud: SolicitudDeGeneracion): string {
  const puertas = [...new Set(solicitud.puertaIds)].sort();
  return sha256Hex(
    JSON.stringify([
      'qr.generar',
      puertas,
      solicitud.venceAt === null ? null : solicitud.venceAt.toISOString(),
      solicitud.etiqueta,
      solicitud.propio,
      solicitud.reemplazar,
    ]),
  );
}
