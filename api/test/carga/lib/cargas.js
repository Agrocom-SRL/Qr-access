// Perfiles de tasa para k6 a partir de texto ("tasa:segundos,tasa:segundos"). Pura: sin k6.

/**
 * Convierte "10:30,50:10,10:30" en etapas de `ramping-arrival-rate` (peticiones por segundo durante N segundos).
 * Una sola etapa es carga constante; varias, ráfagas.
 */
export function etapasDe(texto) {
  return String(texto)
    .split(',')
    .map((parte) => {
      const [tasa, segundos] = parte.trim().split(':').map(Number);
      if (!(tasa >= 0) || !(segundos > 0)) {
        throw new Error(`Etapa de carga inválida "${parte}": se espera tasa:segundos, por ejemplo 10:60.`);
      }
      return { target: tasa, duration: `${segundos}s`, segundos };
    });
}

/** Duración total en segundos. */
export function duracionDe(etapas) {
  return etapas.reduce((total, etapa) => total + etapa.segundos, 0);
}

/**
 * Peticiones que emite un perfil, con un 5 % de margen. Cada etapa rampa linealmente desde la tasa de la etapa
 * anterior hasta la suya, así que su número es la tasa media por su duración. Sirve para comprobar que hay datos
 * (QR, dispositivos) suficientes antes de empezar: si falta uno, la corrida falla al inicio y no a mitad.
 */
export function peticionesDe(etapas) {
  let anterior = 0;
  let total = 0;
  for (const etapa of etapas) {
    total += ((anterior + etapa.target) / 2) * etapa.segundos;
    anterior = etapa.target;
  }
  return Math.ceil(total * 1.05);
}

/** Pico de tasa de un perfil; con él se dimensionan los VU que hacen falta. */
export function tasaMaxima(etapas) {
  return Math.max(...etapas.map((etapa) => etapa.target));
}
