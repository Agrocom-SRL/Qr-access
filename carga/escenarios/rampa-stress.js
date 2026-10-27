// Escenario (f1): rampa de usuarios hasta el punto de quiebre (stress).
//
// La rampa son escalones: cada uno es un número fijo de VU-usuario que leen listados de la app durante
// CARGA_ESCALON_S segundos, con una pausa entre escalones. Cada escalón se etiqueta (`escalon`) y tiene sus
// propios umbrales, así que el "punto de quiebre" es el primer escalón con un umbral caído.
//
// Mientras tanto corre una SONDA de validación de QR a tasa fija (CARGA_SONDA_TASA): es la pregunta del
// aislamiento. Si la validación se degrada a medida que la app se satura, la sonda lo muestra en su escalón.
// Los QR de la sonda son de primer uso (`--qr` en preparar-datos.mjs): hay que pregenerar tasa × duración.
//
// Límites a tener en cuenta: el límite de lectura es por usuario (240 por minuto, ADR 0030 §3.2). Con pocos
// usuarios, el 429 aparece antes que la saturación de la base; para medir capacidad, sube usuarios o la cuota de
// lectura del entorno de prueba (LIMITE_LECTURA_POR_MINUTO), y lo dices en el informe.
import exec from 'k6/execution';
import { SharedArray } from 'k6/data';
import { check, sleep } from 'k6';
import { leerDatos, qrDeUso } from '../lib/datos.js';
import { pedir } from '../lib/http.js';
import { tokenDe, olvidarToken } from '../lib/sesion.js';
import { validarQr } from '../lib/validacion.js';
import { sinDatos } from '../lib/metricas.js';
import { COMPUERTA_VALIDACION, COMPUERTAS_VALIDACION, PROPUESTAS, INFORMATIVO, INFORMATIVO_LIMITES } from '../lib/umbrales.js';
import { resumenDe } from '../lib/resumen.js';

const datos = leerDatos();
const sondaPool = new SharedArray('qr-sonda', () => qrDeUso(datos, 'validacion'));

const ESCALONES = String(__ENV.CARGA_ESCALONES || '5,10,20,40').split(',').map(Number);
const ESCALON_S = Number(__ENV.CARGA_ESCALON_S || 60);
const PAUSA_S = Number(__ENV.CARGA_PAUSA_ESCALON_S || 5);
const SONDA_TASA = Number(__ENV.CARGA_SONDA_TASA || 2);
const PERIODO_S = ESCALON_S + PAUSA_S;
const DURACION_TOTAL_S = ESCALONES.length * PERIODO_S;

if (sondaPool.length < SONDA_TASA * DURACION_TOTAL_S) {
  throw new Error(
    `Faltan QR para la sonda: hacen falta ~${SONDA_TASA * DURACION_TOTAL_S} y hay ${sondaPool.length}. ` +
      'Vuelve a preparar con más --qr.',
  );
}

/** Nombre del escalón (1-based) que cubre el segundo `t` desde el inicio, o `pausa`. */
function escalonEn(t) {
  const k = Math.floor(t / PERIODO_S);
  if (k >= ESCALONES.length) return 'fin';
  return t - k * PERIODO_S < ESCALON_S ? `escalon_${k + 1}` : 'pausa';
}

const escenarios = {
  sonda: {
    executor: 'constant-arrival-rate',
    rate: SONDA_TASA,
    timeUnit: '1s',
    duration: `${DURACION_TOTAL_S}s`,
    preAllocatedVUs: Math.max(5, SONDA_TASA),
    maxVUs: Math.max(20, SONDA_TASA * 3),
    exec: 'sonda',
  },
};
ESCALONES.forEach((vus, k) => {
  escenarios[`escalon_${k + 1}`] = {
    executor: 'constant-vus',
    vus,
    duration: `${ESCALON_S}s`,
    startTime: `${k * PERIODO_S}s`,
    exec: 'carga_app',
  };
});

// Umbrales por escalón: el punto de quiebre sale de aquí.
const umbrales = { ...COMPUERTAS_VALIDACION, ...INFORMATIVO_LIMITES };
ESCALONES.forEach((_vus, k) => {
  const nombre = `escalon_${k + 1}`;
  umbrales[`http_req_duration{endpoint:app_qr,escalon:${nombre}}`] = PROPUESTAS.app;
  umbrales[`http_req_failed{endpoint:app_qr,escalon:${nombre}}`] = ['rate<0.01'];
  umbrales[`http_req_duration{endpoint:validar_qr,escalon:${nombre}}`] = COMPUERTA_VALIDACION;
});
umbrales[`http_req_duration{endpoint:validar_qr,escalon:pausa}`] = INFORMATIVO;

export const options = {
  scenarios: escenarios,
  thresholds: umbrales,
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
};

/** Carga de app: un VU lee listados con la sesión de su usuario. Etiqueta el escalón por el nombre del escenario. */
export function carga_app() {
  const escalon = exec.scenario.name;
  const indice = (exec.vu.idInTest - 1) % datos.usuarios.length;
  const token = tokenDe(datos.usuarios[indice], indice);
  if (token === null) {
    sleep(1);
    return;
  }
  const res = pedir('GET', '/qr-accesos?por_pagina=50', undefined, {
    token,
    tags: { endpoint: 'app_qr', escalon },
  });
  if (res.status === 401) olvidarToken(indice);
  check(res, { 'app: 200': (r) => r.status === 200 }, { endpoint: 'app_qr', escalon });
  sleep(0.5);
}

/** Sonda de validación: un primer uso por iteración, etiquetado por el escalón según su instante de disparo. */
export function sonda() {
  const i = exec.scenario.iterationInInstance;
  if (i >= sondaPool.length) {
    sinDatos.add(1);
    return;
  }
  const qr = sondaPool[i];
  const escalon = escalonEn(i / SONDA_TASA);
  const dispositivo = datos.dispositivos[qr.dispositivo];
  validarQr(dispositivo, qr.texto, { endpoint: 'validar_qr', escalon }, { primerUso: true });
}

const resumen = resumenDe('rampa-stress');

/** Igual que cualquier resumen, más una línea con el primer escalón que cayó (el punto de quiebre). */
export function handleSummary(datosDeLaCorrida) {
  const salida = resumen(datosDeLaCorrida);
  const caidos = [];
  for (const [clave, metrica] of Object.entries(datosDeLaCorrida.metrics ?? {})) {
    for (const [umbral, resultado] of Object.entries(metrica.thresholds ?? {})) {
      if (resultado.ok) continue;
      const m = /escalon:(escalon_\d+)/.exec(clave);
      if (m) caidos.push({ escalon: m[1], detalle: `${clave} ${umbral}` });
    }
  }
  const orden = (e) => Number(e.escalon.split('_')[1]);
  caidos.sort((a, b) => orden(a) - orden(b));
  const primero = caidos.length ? caidos[0].escalon : 'ninguno';
  salida.stdout += `\nPunto de quiebre (primer escalón con un umbral caído): ${primero}\n`;
  return salida;
}
