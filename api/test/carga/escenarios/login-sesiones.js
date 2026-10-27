// Escenario (c): login masivo y sesiones (ADR 0018, ADR 0030 §3.2).
//
// Cada iteración: login con el PIN de un usuario (argon2id en el servidor, el trabajo más caro de la API),
// consulta de la sesión actual y refresco del token. Mide la latencia de cada paso por separado (tags).
//
// Advertencia de diseño: el límite de login es de 20 por minuto y por IP. Sin CARGA_IP_SIMULADAS=1, todos los VU
// salen de la misma IP y el límite corta el escenario con 429: eso es la verificación del límite, no un fallo
// del servidor. Para medir la capacidad del login, usa CARGA_IP_SIMULADAS=1 (ver lib/entorno.js).
import exec from 'k6/execution';
import { check, sleep } from 'k6';
import { leerDatos } from '../lib/datos.js';
import { pedir } from '../lib/http.js';
import { iniciarSesion } from '../lib/sesion.js';
import { PROPUESTAS, INFORMATIVO } from '../lib/umbrales.js';
import { resumenDe } from '../lib/resumen.js';

const datos = leerDatos();
const VUS = Number(__ENV.CARGA_VUS_LOGIN || 10);
const DURACION_S = Number(__ENV.CARGA_DURACION_S || 60);

export const options = {
  scenarios: {
    sesiones: {
      executor: 'constant-vus',
      vus: VUS,
      duration: `${DURACION_S}s`,
      exec: 'sesion',
    },
  },
  thresholds: {
    'http_req_duration{endpoint:login}': PROPUESTAS.login,
    'http_req_duration{endpoint:sesion_actual}': INFORMATIVO,
    'http_req_duration{endpoint:refresco}': INFORMATIVO,
    // Los 429 del límite por IP no son fallos del servidor: con CARGA_IP_SIMULADAS=1 no deben aparecer.
    'checks{endpoint:login}': ['rate>0.99'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
};

export function sesion() {
  const indice = (exec.vu.idInTest - 1 + exec.scenario.iterationInInstance) % datos.usuarios.length;
  const entrada = iniciarSesion(datos.usuarios[indice]);
  check(entrada.res, { 'login: 200 con tokens': () => entrada.acceso !== null }, { endpoint: 'login' });
  if (entrada.acceso === null) {
    sleep(1);
    return;
  }

  const actual = pedir('GET', '/sesiones/actual', undefined, {
    token: entrada.acceso,
    tags: { endpoint: 'sesion_actual' },
  });
  check(actual, { 'sesión actual: 200': (r) => r.status === 200 }, { endpoint: 'sesion_actual' });

  const refresco = pedir('POST', '/sesiones/refresco', { refresco: entrada.refresco }, {
    tags: { endpoint: 'refresco' },
  });
  check(refresco, { 'refresco: 200': (r) => r.status === 200 }, { endpoint: 'refresco' });
  sleep(1);
}

export const handleSummary = resumenDe('login-sesiones');
