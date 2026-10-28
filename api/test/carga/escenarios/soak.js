// Escenario (f2): soak corto (resistencia sostenida) con el ciclo completo de un acceso.
//
// Cada iteración hace lo que pasa en la vida real, sin QR pregenerados: un usuario genera un QR de una puerta
// (POST /qr-accesos), la placa de esa puerta lo valida (POST /dispositivos/validaciones) y confirma la apertura
// (POST /dispositivos/confirmaciones). Así el escenario dura lo que se le pida, sin agotar un archivo de QR.
//
// Para ver si algo se degrada con el tiempo (fugas de conexiones, crecimiento de la base), la duración se parte
// en tres tramos (`tramo`) y cada tramo tiene sus propios umbrales de validación: si el tramo 3 es peor que el 1,
// lo ves en el resumen. Son tendencias, no una prueba de estabilidad de 24 horas: un soak real dura horas.
//
// Límites del ciclo: cada usuario genera como mucho ~10 QR por minuto (ADR 0030 §3.2) y 100 por día (tope
// del plan, `qr.tope_diario`). setup() avisa si la tasa pide más de lo que el número de usuarios permite.
import exec from 'k6/execution';
import { check } from 'k6';
import { leerDatos } from '../lib/datos.js';
import { pedir, leer } from '../lib/http.js';
import { tokenDe, olvidarToken } from '../lib/sesion.js';
import { validarQr } from '../lib/validacion.js';
import { sinDatos } from '../lib/metricas.js';
import { COMPUERTAS_VALIDACION, COMPUERTA_VALIDACION, PROPUESTAS } from '../lib/umbrales.js';
import { resumenDe } from '../lib/resumen.js';
import { CONFIG } from '../lib/entorno.js';

const datos = leerDatos();
const TASA = Number(__ENV.CARGA_SOAK_TASA || 1);
const DURACION_S = Number(__ENV.CARGA_SOAK_S || 300);
const TRAMOS = 3;
const TRAMO_S = DURACION_S / TRAMOS;

const dispositivoDePuerta = Object.fromEntries(datos.dispositivos.map((d) => [d.puerta_id, d]));

/** Tramo (1-3) que corresponde a la iteración `i`, según el instante en que se dispara con la tasa fija. */
function tramoDe(i) {
  return `tramo${Math.min(TRAMOS, Math.floor(i / TASA / TRAMO_S) + 1)}`;
}

export function setup() {
  const necesarias = TASA * DURACION_S;
  const porUsuario = necesarias / datos.usuarios.length;
  if (porUsuario > 100) {
    console.warn(
      `soak: ${necesarias} QR en ${DURACION_S} s reparten ${porUsuario.toFixed(0)} por usuario; el tope diario es 100.`,
    );
  }
  if (porUsuario * 6 > DURACION_S) {
    console.warn(
      'soak: la tasa supera ~10 QR por minuto y usuario; el límite generar_qr cortará con 429 (es el resultado esperado).',
    );
  }
  return {};
}

const umbrales = { ...COMPUERTAS_VALIDACION };
const tramos = [1, 2, 3].map((n) => `tramo${n}`);
for (const tramo of tramos) {
  umbrales[`http_req_duration{endpoint:validar_qr,tramo:${tramo}}`] = COMPUERTA_VALIDACION;
}

export const options = {
  scenarios: {
    ciclo: {
      executor: 'constant-arrival-rate',
      rate: TASA,
      timeUnit: '1s',
      duration: `${DURACION_S}s`,
      preAllocatedVUs: Math.max(5, TASA * 2),
      maxVUs: Math.max(20, TASA * 5),
      exec: 'ciclo',
    },
  },
  thresholds: {
    ...umbrales,
    'http_req_duration{endpoint:generar_qr}': PROPUESTAS.generacion,
    'http_req_duration{endpoint:confirmacion}': PROPUESTAS.confirmacion,
    'checks{endpoint:confirmacion}': ['rate>0.99'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
};

/** Un ciclo completo: generar, validar y confirmar. Los 429 de generación cuentan, no abortan la corrida. */
export function ciclo() {
  const i = exec.scenario.iterationInInstance;
  const tramo = tramoDe(i);
  const indice = i % datos.usuarios.length;
  const token = tokenDe(datos.usuarios[indice], indice);
  if (token === null) {
    sinDatos.add(1, { endpoint: 'login' });
    return;
  }
  const puerta = datos.puertas[i % datos.puertas.length];
  const dispositivo = dispositivoDePuerta[puerta.id];
  if (dispositivo === undefined) {
    sinDatos.add(1, { endpoint: 'dispositivo' });
    return;
  }

  const generado = pedir('POST', '/qr-accesos', { puerta_ids: [puerta.id], etiqueta: 'soak' }, {
    token,
    idempotencia: CONFIG.idempotencia ? `soak-${i}-${Date.now()}` : undefined,
    tags: { endpoint: 'generar_qr', tramo },
  });
  if (generado.status === 401) olvidarToken(indice);
  check(generado, { 'generación: 201': (r) => r.status === 201 }, { endpoint: 'generar_qr', tramo });
  if (generado.status !== 201) return;

  const texto = leer(generado).texto;
  const validacion = validarQr(dispositivo, texto, { endpoint: 'validar_qr', tramo }, { primerUso: true });
  if (!validacion.abre) return;

  const confirmacion = pedir(
    'POST',
    '/dispositivos/confirmaciones',
    { evento_id: validacion.cuerpo.evento_id, resultado: 'ejecutada' },
    { dispositivo, tags: { endpoint: 'confirmacion', tramo } },
  );
  check(confirmacion, { 'confirmación: 204': (r) => r.status === 204 }, { endpoint: 'confirmacion', tramo });
}

export const handleSummary = resumenDe('soak');
