// Escenario de verificación de límites (ADR 0030 §3.2 y §7, ADR 0032 §1). No mide rendimiento: comprueba que los
// límites de la API responden como dice el ADR, con sus códigos y su Retry-After.
//
//  - `limite_login`: 25 logins seguidos desde una IP. Por omisión (LIMITE_LOGIN_POR_MINUTO=20) los 20 primeros
//    pasan y los siguientes son 429 `limite.excedido` con Retry-After.
//  - `limite_generacion`: 12 QR seguidos de un usuario. Los 10 primeros son 201 y los siguientes, 429
//    `limite.excedido` con Retry-After (ráfaga `generar_qr`, LIMITE_GENERAR_QR_POR_MINUTO=10).
//
// Son ventanas de un minuto. Corre este escenario SOLO, con la API recién arrancada o al menos 60 s después de
// otra corrida, o los contadores ya estarán gastados y los resultados no significarán nada. Todas las peticiones
// salen con la misma IP real (ip: false), sin X-Forwarded-For.
//
// La cuota diaria (`qr.limite_diario`) y la de pendientes (`qr.limite_pendientes`) no entran aquí: exigen cientos
// de QR y un día entero. Se verifican a mano (docs/gestion/pruebas-de-carga.md, "Qué se verifica").
import { check } from 'k6';
import { leerDatos } from '../lib/datos.js';
import { pedir, leer } from '../lib/http.js';
import { iniciarSesion } from '../lib/sesion.js';
import { resumenDe } from '../lib/resumen.js';

const datos = leerDatos();
const LOGINS = Number(__ENV.CARGA_LIMITE_LOGINS || 25);
const LOGIN_PERMITIDOS = Number(__ENV.LIMITE_LOGIN_POR_MINUTO || 20);
const QR = Number(__ENV.CARGA_LIMITE_QR || 12);
const QR_PERMITIDOS = Number(__ENV.LIMITE_GENERAR_QR_POR_MINUTO || 10);

export const options = {
  scenarios: {
    limite_login: { executor: 'shared-iterations', vus: 1, iterations: 1, exec: 'limiteLogin', maxDuration: '3m' },
    limite_generacion: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      exec: 'limiteGeneracion',
      // Arranca tras la ventana del login: su propio login cuenta contra el mismo límite por IP.
      startTime: '65s',
      maxDuration: '3m',
    },
  },
  thresholds: {
    checks: ['rate==1'],
  },
};

/** Login repetido desde una IP: los primeros LOGIN_PERMITIDOS pasan y el resto recibe 429 con Retry-After. */
export function limiteLogin() {
  const usuario = datos.usuarios[0];
  const estados = [];
  let conRetryAfter = 0;
  for (let n = 0; n < LOGINS; n++) {
    const res = pedir('POST', '/sesiones', { pin: usuario.pin }, {
      tags: { endpoint: 'login_limite' },
      ip: false,
    });
    estados.push(res.status);
    if (res.status === 429 && res.headers['Retry-After'] !== undefined) {
      conRetryAfter++;
      const cuerpo = leer(res);
      check(cuerpo, { 'login 429: code limite.excedido': (c) => c?.code === 'limite.excedido' });
    }
  }
  check(estados, {
    'login: los primeros pasan (200)': (e) => e.slice(0, LOGIN_PERMITIDOS).every((s) => s === 200),
    'login: desde el límite, 429': (e) => e.slice(LOGIN_PERMITIDOS).every((s) => s === 429),
    'login: los 429 traen Retry-After': () => conRetryAfter === Math.max(0, LOGINS - LOGIN_PERMITIDOS),
  });
}

/** Ráfaga de generación de un usuario: los primeros QR_PERMITIDOS pasan y el resto recibe 429 `limite.excedido`. */
export function limiteGeneracion() {
  const sesion = iniciarSesion(datos.usuarios[0], { ip: false, tags: { endpoint: 'login_generacion' } });
  if (sesion.acceso === null) {
    check(null, { 'generación: el login de la prueba entra': () => false });
    return;
  }
  const puerta = datos.puertas[0];
  const estados = [];
  const codigos = [];
  for (let n = 0; n < QR; n++) {
    const res = pedir('POST', '/qr-accesos', { puerta_ids: [puerta.id], etiqueta: 'limite' }, {
      token: sesion.acceso,
      ip: false,
      tags: { endpoint: 'generar_limite' },
    });
    estados.push(res.status);
    if (res.status === 429) codigos.push(leer(res)?.code);
  }
  check(estados, {
    'generación: las primeras pasan (201)': (e) => e.slice(0, QR_PERMITIDOS).every((s) => s === 201),
    'generación: desde el límite, 429': (e) => e.slice(QR_PERMITIDOS).every((s) => s === 429),
  });
  check(codigos, {
    'generación 429: code limite.excedido': (c) => c.length > 0 && c.every((code) => code === 'limite.excedido'),
  });
}

export const handleSummary = resumenDe('verificar-limites');
