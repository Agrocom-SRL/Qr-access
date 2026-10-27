// Escenario (a): validación de QR desde las placas (ADR 0008, 0009, 0032).
//
// Qué mide: la latencia de POST /dispositivos/validaciones con ráfagas de primeros usos, y que la puerta
// nunca abre sin validación positiva ni dos veces con el mismo QR.
// Compuertas: p95 < 1 s, p99 < 2 s, 0 respuestas no válidas, 0 aperturas inesperadas (ver lib/umbrales.js).
//
// Uso (desde la raíz del repo, con los datos de preparar-datos.mjs):
//   CARGA_ENTORNO=prueba CARGA_URL=http://127.0.0.1:3000 CARGA_DATOS=/ruta/absoluta/prueba.json \
//   CARGA_ETAPAS=10:30,50:10,10:30 k6 run carga/escenarios/validacion-qr.js
import { comprobarDatos, escenariosDeValidacion, validar, repetir } from '../lib/escenario-validacion.js';
import { COMPUERTAS_VALIDACION } from '../lib/umbrales.js';
import { resumenDe } from '../lib/resumen.js';

// k6 busca estas funciones por nombre entre las exportaciones del script.
export { validar, repetir };

comprobarDatos();

export const options = {
  scenarios: escenariosDeValidacion(),
  thresholds: COMPUERTAS_VALIDACION,
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
};

export const handleSummary = resumenDe('validacion-qr');
