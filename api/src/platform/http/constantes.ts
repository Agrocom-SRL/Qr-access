/** Prefijo de la versión vigente de la API (ADR 0005). Un cambio incompatible es `/api/v2`. */
export const PREFIJO_API = '/api/v1';

/** Tamaño máximo de un body JSON: ninguna petición de la API necesita más (ADR 0005). */
export const LIMITE_BODY_BYTES = 64 * 1024;
