// Guardarraíles de las pruebas de carga (ADR 0030 §3, invariante "nunca contra producción").
// Lo usan los escenarios k6 y preparar-datos.mjs, así que es JavaScript puro: sin imports de k6 ni de Node.
// Extensión .mjs a propósito: el repo no tiene package.json raíz y Node tiene que leerlo como ESM.

/** Dominio público de AGROCOM. Ningún host de este dominio es un destino de carga, aunque se declare de prueba. */
const DOMINIO_AGROCOM = /(^|\.)agrocom\.com\.bo$/i;

/** Destinos que siempre son de prueba: la máquina que corre la carga. */
const HOSTS_LOCALES = ['localhost', '127.0.0.1', '[::1]'];

/** Sin esta variable explícita, ningún escenario toca la red. Evita correr por error contra la base equivocada. */
export function exigirEntornoDePrueba(env) {
  if (env.CARGA_ENTORNO !== 'prueba') {
    throw new Error(
      'Las pruebas de carga solo corren con CARGA_ENTORNO=prueba. Ver docs/gestion/pruebas-de-carga.md.',
    );
  }
}

/**
 * Parsea `http(s)://host[:puerto]` sin depender de la clase `URL` (k6 no la trae completa en todas las
 * versiones). Solo acepta origen: el `/api/v1` lo agregan los scripts.
 */
export function descomponerOrigen(texto) {
  const m = /^(https?):\/\/(\[[^\]]+\]|[^/:?#]+)(?::(\d+))?\/?$/i.exec(String(texto ?? '').trim());
  if (!m) {
    throw new Error(`CARGA_URL debe ser solo el origen, por ejemplo http://127.0.0.1:3000 (recibido: ${texto}).`);
  }
  return { protocolo: m[1].toLowerCase(), host: m[2].toLowerCase(), puerto: m[3] ?? '' };
}

/**
 * Devuelve el origen si el host es de prueba. Rechaza cualquier dominio de AGROCOM y cualquier host que no
 * sea local ni esté declarado en CARGA_HOSTS_DE_PRUEBA (lista separada por comas). Declarar un host es una
 * decisión explícita de quien opera la prueba, nunca un valor por omisión.
 */
export function exigirOrigenDePrueba(texto, env) {
  const { host } = descomponerOrigen(texto);
  if (DOMINIO_AGROCOM.test(host)) {
    throw new Error(
      `${host} es un host de AGROCOM (producción o su dominio público). Las pruebas de carga nunca corren contra producción.`,
    );
  }
  const declarados = String(env.CARGA_HOSTS_DE_PRUEBA ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (!HOSTS_LOCALES.includes(host) && !declarados.includes(host)) {
    throw new Error(`${host} no está en CARGA_HOSTS_DE_PRUEBA. Declara el host de prueba de forma explícita.`);
  }
  return String(texto).trim().replace(/\/+$/, '');
}

/** Valida el entorno y devuelve la base de la API (`<origen>/api/v1`). Falla antes de cualquier petición. */
export function configuracionDeCarga(env) {
  exigirEntornoDePrueba(env);
  const origen = exigirOrigenDePrueba(env.CARGA_URL, env);
  return { base: `${origen}/api/v1` };
}
