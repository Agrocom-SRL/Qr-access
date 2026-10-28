// Escenario de validación de QR (a, y como carga de fondo en d). Dos fases en la misma corrida:
//
//  1. `validacion`: ráfagas o carga constante de primeros usos. Cada iteración usa un QR distinto, pregenerado
//     por preparar-datos.mjs, con la credencial de la placa de su puerta. Se espera `abrir: true` en todos.
//  2. `repeticion`: al terminar la fase 1 (más de la ventana de 15 s de ADR 0032 §3), vuelve a presentar QR que
//     ya se usaron durante la preparación. Se espera `qr.usado` y ninguna apertura.
//
// Los QR de repetición se consumen en preparar-datos.mjs ANTES de la corrida, así que la fase 2 no depende de lo
// que pase en la fase 1. Por eso el arranque de la fase 2 deja pasar más de 15 s desde el último uso.
import exec from 'k6/execution';
import { SharedArray } from 'k6/data';
import { check } from 'k6';
import { CONFIG } from './entorno.js';
import { leerDatos, qrDeUso } from './datos.js';
import { etapasDe, duracionDe, peticionesDe, tasaMaxima } from './cargas.js';
import { validarQr } from './validacion.js';
import { aperturasInesperadas, sinDatos } from './metricas.js';
import { leer } from './http.js';

const datos = leerDatos();
const pool = new SharedArray('qr-validacion', () => qrDeUso(datos, 'validacion'));
const repeticion = new SharedArray('qr-repeticion', () => qrDeUso(datos, 'repeticion'));

export const ETAPAS = etapasDe(CONFIG.etapas);
const DURACION_S = duracionDe(ETAPAS);
const MAXIMO_REPETICIONES = Number(__ENV.CARGA_REPETICIONES || 5);
export const REPETICIONES = Math.min(repeticion.length, MAXIMO_REPETICIONES);

/** Los QR que hacen falta para la fase de validación. Se comprueba antes de empezar, no a mitad de la corrida. */
export function comprobarDatos() {
  const necesarios = peticionesDe(ETAPAS);
  if (pool.length < necesarios) {
    throw new Error(
      `Faltan QR de validación: el perfil emite hasta ~${necesarios} peticiones y el archivo tiene ${pool.length}. ` +
        'Vuelve a preparar con más --qr.',
    );
  }
  if (repeticion.length < REPETICIONES) {
    throw new Error(`Faltan QR de repetición: se piden ${REPETICIONES} y hay ${repeticion.length}.`);
  }
}

/**
 * Escenarios de k6 para la validación. `inicioEn` (segundos) desplaza la fase de repetición para que empiece
 * después de la de validación más la ventana de 15 s.
 */
export function escenariosDeValidacion({ prefijo = '', inicioEn = 0 } = {}) {
  const maxVus = Math.max(20, tasaMaxima(ETAPAS) * 3);
  const escenarios = {
    [`${prefijo}validacion`]: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: Math.max(5, Math.ceil(tasaMaxima(ETAPAS) / 2)),
      maxVUs: maxVus,
      stages: ETAPAS.map(({ target, duration }) => ({ target, duration })),
      startTime: `${inicioEn}s`,
      exec: 'validar',
    },
  };
  if (REPETICIONES > 0) {
    escenarios[`${prefijo}repeticion`] = {
      executor: 'shared-iterations',
      vus: 1,
      iterations: REPETICIONES,
      maxDuration: '2m',
      startTime: `${inicioEn + DURACION_S + 20}s`,
      exec: 'repetir',
    };
  }
  return escenarios;
}

/** Un primer uso por iteración: el QR de la posición `iterationInInstance`, con la placa de su puerta. */
export function validar() {
  const i = exec.scenario.iterationInInstance;
  if (i >= pool.length) {
    sinDatos.add(1);
    return;
  }
  const qr = pool[i];
  const dispositivo = datos.dispositivos[qr.dispositivo];
  const { res, abre, valida } = validarQr(dispositivo, qr.texto, { endpoint: 'validar_qr' }, { primerUso: true });
  check(res, {
    'validación: respuesta válida': () => valida,
    'validación: abre el primer uso': () => abre,
  });
}

/** Repetición de QR ya usados: el servidor debe rechazarlos como `qr.usado`, nunca abrir (invariante 3). */
export function repetir() {
  const i = exec.scenario.iterationInInstance;
  if (i >= repeticion.length) {
    sinDatos.add(1);
    return;
  }
  const qr = repeticion[i];
  const dispositivo = datos.dispositivos[qr.dispositivo];
  const { abre, valida, res } = validarQr(dispositivo, qr.texto, { endpoint: 'repeticion' });
  if (abre) aperturasInesperadas.add(1, { endpoint: 'repeticion' });
  check(res, {
    'repetición: rechazada como qr.usado': () => valida && leer(res)?.motivo_code === 'qr.usado',
  });
}
