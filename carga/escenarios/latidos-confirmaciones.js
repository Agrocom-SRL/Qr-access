// Escenario (e): latidos de las placas y confirmaciones de apertura (ADR 0009, ADR 0031 §18).
//
// Dos cargas a la vez:
//  - `latidos`: cada VU es una placa que informa su estado cada CARGA_LATIDO_S segundos (por omisión 5).
//    Es el tráfico de fondo de toda la flota: un latido cada pocos segundos por placa.
//  - `confirmaciones`: a una tasa fija, una placa valida un QR (primer uso, con compuertas de validación) y
//    confirma la apertura con POST /dispositivos/confirmaciones (204). Usa QR pregenerados con
//    `--qr-confirmacion` en preparar-datos.mjs: cada uno se consume una vez.
import exec from 'k6/execution';
import { SharedArray } from 'k6/data';
import { check, sleep } from 'k6';
import { leerDatos, qrDeUso } from '../lib/datos.js';
import { pedir } from '../lib/http.js';
import { validarQr } from '../lib/validacion.js';
import { sinDatos } from '../lib/metricas.js';
import { COMPUERTAS_VALIDACION, PROPUESTAS } from '../lib/umbrales.js';
import { resumenDe } from '../lib/resumen.js';

const datos = leerDatos();
const confirmacion = new SharedArray('qr-confirmacion', () => qrDeUso(datos, 'confirmacion'));
const DURACION_S = Number(__ENV.CARGA_DURACION_S || 60);
const LATIDO_S = Number(__ENV.CARGA_LATIDO_S || 5);
const TASA = Number(__ENV.CARGA_TASA_CONFIRMACION || 1);
// Una iteración más de las previstas por el arrival-rate: se pregenera un QR de margen. Falla antes de empezar.
if (confirmacion.length < TASA * DURACION_S + 1) {
  throw new Error(
    `Faltan QR de confirmación: hacen falta ${TASA * DURACION_S + 1} y hay ${confirmacion.length}. Vuelve a preparar con --qr-confirmacion.`,
  );
}

export const options = {
  scenarios: {
    latidos: {
      executor: 'constant-vus',
      vus: datos.dispositivos.length,
      duration: `${DURACION_S}s`,
      exec: 'latir',
    },
    confirmaciones: {
      executor: 'constant-arrival-rate',
      rate: TASA,
      timeUnit: '1s',
      duration: `${DURACION_S}s`,
      preAllocatedVUs: Math.max(2, TASA * 2),
      maxVUs: Math.max(10, TASA * 5),
      exec: 'confirmar',
    },
  },
  thresholds: {
    ...COMPUERTAS_VALIDACION,
    'http_req_duration{endpoint:latido}': PROPUESTAS.latido,
    'http_req_duration{endpoint:confirmacion}': PROPUESTAS.confirmacion,
    'checks{endpoint:latido}': ['rate>0.99'],
    'checks{endpoint:confirmacion}': ['rate>0.99'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
};

/** Una placa informa que está viva. 204 si el servidor lo registró. */
export function latir() {
  const dispositivo = datos.dispositivos[(exec.vu.idInTest - 1) % datos.dispositivos.length];
  const res = pedir(
    'POST',
    '/dispositivos/latidos',
    { firmware: '1.0.0-carga', rssi: -60, puerta_abierta: false, lector_responde: true },
    { dispositivo, tags: { endpoint: 'latido' } },
  );
  check(res, { 'latido: 204': (r) => r.status === 204 }, { endpoint: 'latido' });
  sleep(LATIDO_S);
}

/** Valida un QR de confirmación y, si la placa abriría, confirma la apertura. */
export function confirmar() {
  const i = exec.scenario.iterationInInstance;
  if (i >= confirmacion.length) {
    sinDatos.add(1);
    return;
  }
  const qr = confirmacion[i];
  const dispositivo = datos.dispositivos[qr.dispositivo];
  const validacion = validarQr(dispositivo, qr.texto, { endpoint: 'validar_qr' }, { primerUso: true });
  if (!validacion.abre) return;

  const res = pedir(
    'POST',
    '/dispositivos/confirmaciones',
    { evento_id: validacion.cuerpo.evento_id, resultado: 'ejecutada' },
    { dispositivo, tags: { endpoint: 'confirmacion' } },
  );
  check(res, { 'confirmación: 204': (r) => r.status === 204 }, { endpoint: 'confirmacion' });
}

export const handleSummary = resumenDe('latidos-confirmaciones');
