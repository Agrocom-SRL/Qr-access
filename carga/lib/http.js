// Cliente HTTP de las pruebas: una sola puerta para llamar a la API, con cabeceras, etiquetas y lectura segura.
import http from 'k6/http';
import exec from 'k6/execution';
import { CONFIG } from './entorno.js';
import { limitesAplicados } from './metricas.js';

/**
 * IP sintética por VU, dentro de 198.18.0.0/15 (rango de pruebas de RFC 2544, no enrutable). Solo se usa con
 * CARGA_IP_SIMULADAS=1: así el límite por IP del login (ADR 0030 §3.2) no corta a todos los VU juntos.
 */
export function ipDeVu() {
  const n = exec.vu.idInTest;
  return `198.18.${Math.floor(n / 250) % 256}.${(n % 250) + 1}`;
}

function cabeceras({ token, dispositivo, ip, conCuerpo, idempotencia }) {
  const h = {};
  if (conCuerpo) h['Content-Type'] = 'application/json';
  if (dispositivo) h.Authorization = `Dispositivo ${dispositivo.id}.${dispositivo.clave}`;
  else if (token) h.Authorization = `Bearer ${token}`;
  // `ip: false` desactiva la cabecera (la prueba de límites necesita una sola IP real).
  if (CONFIG.ipSimuladas && ip !== false) h['X-Forwarded-For'] = ip ?? ipDeVu();
  if (idempotencia) h['Idempotency-Key'] = idempotencia;
  return h;
}

/**
 * Una petición a la API con etiquetas (`endpoint` es obligatoria: así las métricas salen por ruta).
 * Devuelve la respuesta de k6. Cuenta los 429 y 503 que traen Retry-After (para verificar ADR 0030/0032).
 */
export function pedir(metodo, ruta, cuerpo, { tags, token, dispositivo, ip, idempotencia } = {}) {
  const params = {
    headers: cabeceras({
      token,
      dispositivo,
      ip,
      conCuerpo: cuerpo !== undefined,
      idempotencia,
    }),
    tags,
    timeout: '10s',
  };
  const url = CONFIG.base + ruta;
  const res =
    cuerpo === undefined
      ? http.request(metodo, url, null, params)
      : http.request(metodo, url, JSON.stringify(cuerpo), params);
  if ((res.status === 429 || res.status === 503) && res.headers['Retry-After'] !== undefined) {
    limitesAplicados.add(1, { endpoint: tags.endpoint, status: String(res.status) });
  }
  return res;
}

/** El cuerpo como objeto, o `null` si no es JSON. Nunca lanza: una respuesta rota no debe tumbar el VU. */
export function leer(res) {
  try {
    return res.json();
  } catch (_error) {
    return null;
  }
}
