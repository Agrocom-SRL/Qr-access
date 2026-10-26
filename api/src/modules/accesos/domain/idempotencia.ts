import { sha256Hex } from '../../../platform/seguridad/tokens.js';

/**
 * Cuánto se recuerda una clave de idempotencia (ADR 0031 §11, «vencimiento corto»). Cubre de sobra los reintentos
 * de una app con mala red (la app descarta la clave al recibir la respuesta); pasado el lapso, la misma clave se
 * trata como una solicitud nueva. Supuesto: el ADR no fija la cifra; 24 h es el estándar de la industria.
 */
export const VIGENCIA_DE_CLAVE_DE_IDEMPOTENCIA_HORAS = 24;

/** Largo mínimo y máximo de la clave que manda la app (un UUID mide 36). Una clave corta sería adivinable. */
export const LARGO_MINIMO_DE_CLAVE = 16;
export const LARGO_MAXIMO_DE_CLAVE = 128;

/** Caracteres que admite la clave: los de un UUID, un ULID o un token base64url. */
export const FORMATO_DE_CLAVE = /^[A-Za-z0-9_.:-]+$/;

/** Operación a la que pertenece una clave (una misma clave puede repetirse entre operaciones distintas). */
export type OperacionIdempotente = 'qr.generar';

/** Lo único que se guarda de la clave: su SHA-256. */
export const hashDeClave = (clave: string): string => sha256Hex(clave);

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
