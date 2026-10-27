// Métricas propias de las pruebas de carga. Se crean en el init (k6 no las admite después).
import { Counter } from 'k6/metrics';

/**
 * Respuestas con las que la placa NO abriría: cualquier cosa distinta de un 200 con `abrir` booleano y
 * `evento_id` (ADR 0009: sin respuesta válida, la puerta no abre). Se etiqueta por `endpoint`.
 */
export const respuestasNoValidas = new Counter('respuestas_no_validas');

/**
 * Aperturas que el servidor ordena cuando no debía: un QR de repetición (ya usado) que abre, o un
 * `abrir: true` en una lectura que no corresponde. Debe ser 0 (invariante 3).
 */
export const aperturasInesperadas = new Counter('aperturas_inesperadas');

/** Aperturas correctas del primer uso de un QR (informativo). */
export const validacionesAbren = new Counter('validaciones_abren');

/** Rechazos de negocio con su motivo (`motivo_code`), informativo. */
export const rechazos = new Counter('validaciones_rechazadas');

/**
 * Primeros usos que la placa NO puede abrir (el servidor rechazó un QR que debía valer): datos mal preparados,
 * suscripción vencida, QR de otra puerta. Debe ser 0. Los QR de repetición no cuentan: ahí el rechazo es lo esperado.
 */
export const primerosUsosRechazados = new Counter('primeros_usos_rechazados');

/** Peticiones que no tenían dato para ejecutarse: el dimensionamiento de la prueba está mal. Debe ser 0. */
export const sinDatos = new Counter('sin_datos');

/** 429 o 503 con su cabecera Retry-After presente, para verificar ADR 0030 §3 y ADR 0032 §1. */
export const limitesAplicados = new Counter('limites_aplicados');
