// Escenario (d): saturación de la API de usuarios MIENTRAS corre la validación de placas.
//
// Es la prueba clave del aislamiento de pools (ADR 0032 §1): las rutas del dispositivo usan su propio pool
// (`dispositivos`) y su propio tiempo máximo; las de la app, otro (`app`). Si el pool de la app se llena, la
// validación NO debe degradarse. Este escenario la prueba con las mismas compuertas que (a):
// p95 < 1 s, p99 < 2 s y cero respuestas no válidas de validación.
//
// Carga de fondo: VU que leen listados (QR y eventos) con las sesiones de los usuarios de prueba. Lo que
// responda la app (429, 503, latencias) se informa, pero NO es una compuerta: es lo que se satura.
//
// Uso: igual que validacion-qr.js, con CARGA_VUS_APP (VU de la app, por omisión 20) y CARGA_DURACION_S.
// Con CARGA_IP_SIMULADAS=1: los VU entran por el login sin tropezar con el límite por IP (ADR 0030 §3.2).
import exec from 'k6/execution';
import { sleep } from 'k6';
import { leerDatos } from '../lib/datos.js';
import { pedir } from '../lib/http.js';
import { tokenDe, olvidarToken } from '../lib/sesion.js';
import { comprobarDatos, escenariosDeValidacion, validar, repetir } from '../lib/escenario-validacion.js';
import { COMPUERTAS_VALIDACION, INFORMATIVO, INFORMATIVO_LIMITES } from '../lib/umbrales.js';
import { resumenDe } from '../lib/resumen.js';

// k6 busca estas funciones por nombre entre las exportaciones del script.
export { validar, repetir };

const datos = leerDatos();
comprobarDatos();

const VUS_APP = Number(__ENV.CARGA_VUS_APP || 20);
const DURACION_S = Number(__ENV.CARGA_DURACION_S || 60);

export const options = {
  scenarios: {
    ...escenariosDeValidacion(),
    saturacion_app: {
      executor: 'constant-vus',
      vus: VUS_APP,
      duration: `${DURACION_S}s`,
      exec: 'saturar',
    },
  },
  thresholds: {
    ...COMPUERTAS_VALIDACION,
    ...INFORMATIVO_LIMITES,
    // La app se satura a propósito: se mide, no se exige.
    'http_req_duration{endpoint:app_qr}': INFORMATIVO,
    'http_req_duration{endpoint:app_eventos}': INFORMATIVO,
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
};

/** Un VU lee listados con la sesión de un usuario, sin pausa: así llena el pool de la app. */
export function saturar() {
  const indice = (exec.vu.idInTest - 1) % datos.usuarios.length;
  const token = tokenDe(datos.usuarios[indice], indice);
  if (token === null) {
    sleep(1);
    return;
  }
  const qr = pedir('GET', '/qr-accesos?por_pagina=50', undefined, {
    token,
    tags: { endpoint: 'app_qr' },
  });
  if (qr.status === 401) olvidarToken(indice);
  const eventos = pedir('GET', '/lecturas?por_pagina=50', undefined, {
    token,
    tags: { endpoint: 'app_eventos' },
  });
  if (eventos.status === 401) olvidarToken(indice);
}

export const handleSummary = resumenDe('saturacion-usuarios');
