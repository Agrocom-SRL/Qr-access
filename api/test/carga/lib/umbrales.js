// Umbrales de las pruebas de carga. Hay dos clases y el documento las separa (docs/gestion/pruebas-de-carga.md §3):
//
//  - COMPUERTAS: el objetivo de W13 para validar un QR (p95 < 1 s, p99 < 2 s) y las garantías de seguridad
//    (0 aperturas inesperadas, 0 respuestas no válidas de la validación). Si fallan, la corrida falla.
//  - PROPUESTAS: números razonables sin respaldo en un ADR. Sirven para ver tendencias y se AFINAN con una corrida
//    real; no se tratan como requisito hasta que alguien los apruebe.
//
// Nota de k6: una clave con `{endpoint:…}` solo produce sub-métricas en el resumen si tiene umbral. Por eso
// las rutas que solo se miden ponen su umbral informativo `p(95)>=0` (trends) o `count>=0` (contadores), que
// siempre pasan. Un contador no admite `p(…)`: k6 aborta la corrida al arrancar.

/** Tiempo de respuesta de la validación (ADR 0032 §1: la placa espera 3 s; el objetivo es mucho menos). */
export const COMPUERTA_VALIDACION = ['p(95)<1000', 'p(99)<2000'];

export const COMPUERTAS_VALIDACION = {
  'http_req_duration{endpoint:validar_qr}': COMPUERTA_VALIDACION,
  'http_req_failed{endpoint:validar_qr}': ['rate<0.001'],
  'respuestas_no_validas{endpoint:validar_qr}': ['count==0'],
  'aperturas_inesperadas': ['count==0'],
  'primeros_usos_rechazados': ['count==0'],
  'sin_datos': ['count==0'],
};

/** Informativo: sin umbral real, para que la sub-métrica exista en el resumen. */
export const INFORMATIVO = ['p(95)>=0'];

/**
 * Desglose de los 429 y 503 con Retry-After por código. Sin umbral, la sub-métrica no aparece en el resumen: esto
 * deja ver si la saturación cortó por el límite por usuario (429) o por el pool de la app (503, ADR 0032 §1).
 */
export const INFORMATIVO_LIMITES = {
  // Los contadores solo admiten `count` y `rate`; un `p(95)` aquí hace fallar la corrida al arrancar.
  'limites_aplicados{status:429}': ['count>=0'],
  'limites_aplicados{status:503}': ['count>=0'],
};

/** PROPUESTAS, sin ADR. Se afinan con los datos del entorno real. */
export const PROPUESTAS = {
  generacion: ['p(95)<1000'],
  login: ['p(95)<1500'],
  confirmacion: ['p(95)<1000'],
  latido: ['p(95)<1000'],
  app: ['p(95)<2000'],
};
