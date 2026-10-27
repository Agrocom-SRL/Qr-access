// Escenario (b): generación de QR por usuarios (ADR 0030 §2 y §3.2, ADR 0031 §9).
//
// Cada VU es un usuario de prueba (Titular) que genera QR de una puerta. Por omisión respeta la cadencia de
// ~10 QR por minuto por usuario (el límite de ráfaga `generar_qr`): así mide la latencia de la generación sin
// que el límite corte. Con CARGA_GENERACION_SIN_PAUSA=1 martillea a propósito y se comprueba que el servidor
// responde 429 `limite.excedido` con Retry-After (ADR 0030 §3.2), y que los topes del plan responden 429 `qr.limite_*`.
//
// Idempotency-Key: con CARGA_IDEMPOTENCIA=1 se manda la cabecera. W6 la introduce; en esta base la API la ignora,
// así que el escenario no prueba idempotencia todavía (ver docs/gestion/pruebas-de-carga.md, "Qué no mide").
import exec from 'k6/execution';
import { check, sleep } from 'k6';
import { CONFIG } from '../lib/entorno.js';
import { leerDatos } from '../lib/datos.js';
import { pedir } from '../lib/http.js';
import { tokenDe, olvidarToken } from '../lib/sesion.js';
import { PROPUESTAS, INFORMATIVO, INFORMATIVO_LIMITES } from '../lib/umbrales.js';
import { resumenDe } from '../lib/resumen.js';

const datos = leerDatos();
const DURACION_S = Number(__ENV.CARGA_DURACION_S || 60);
const SIN_PAUSA = __ENV.CARGA_GENERACION_SIN_PAUSA === '1';
/** 60 s / 10 QR por minuto = 6 s entre QR de un mismo usuario. */
const PAUSA_S = Number(__ENV.CARGA_PAUSA_GENERACION_S || 6);

export const options = {
  scenarios: {
    generar: {
      executor: 'constant-vus',
      vus: datos.usuarios.length,
      duration: `${DURACION_S}s`,
      exec: 'generar',
    },
  },
  thresholds: {
    ...INFORMATIVO_LIMITES,
    // Con cadencia respetuosa, la generación debe responder rápido y sin error. Sin pausa, los 429 son el resultado.
    'http_req_duration{endpoint:generar_qr}': SIN_PAUSA ? INFORMATIVO : PROPUESTAS.generacion,
    'checks{endpoint:generar_qr}': SIN_PAUSA ? INFORMATIVO : ['rate>0.99'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
};

/** Un QR por iteración, de una puerta rotatoria, con la sesión del usuario de este VU. */
export function generar() {
  const indice = (exec.vu.idInTest - 1) % datos.usuarios.length;
  const token = tokenDe(datos.usuarios[indice], indice);
  if (token === null) {
    sleep(PAUSA_S);
    return;
  }
  const puerta = datos.puertas[exec.scenario.iterationInInstance % datos.puertas.length];
  const idempotencia = CONFIG.idempotencia
    ? `carga-${exec.vu.idInTest}-${exec.scenario.iterationInInstance}-${Date.now()}`
    : undefined;

  const res = pedir('POST', '/qr-accesos', { puerta_ids: [puerta.id], etiqueta: 'carga' }, {
    token,
    idempotencia,
    tags: { endpoint: 'generar_qr' },
  });
  if (res.status === 401) olvidarToken(indice);
  check(
    res,
    {
      // 201 es lo normal. Con SIN_PAUSA, el 429 también es un resultado esperado del límite.
      'QR generado (201)': (r) => r.status === 201 || (SIN_PAUSA && r.status === 429),
    },
    { endpoint: 'generar_qr' },
  );
  if (!SIN_PAUSA) sleep(PAUSA_S);
}

export const handleSummary = resumenDe('generacion-qr');
