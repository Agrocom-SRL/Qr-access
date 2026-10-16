/** Reglas de sitios y puertas de una cuenta (HU-07, HU-08). Espejo de lo que valida la API. */

export const ZONA_POR_DEFECTO = 'America/La_Paz';

/** Cuánto queda abierta la cerradura por cada pulso: lo que soporta el hardware (1 a 30 s). */
export const SEGUNDOS_MINIMOS = 1;
export const SEGUNDOS_MAXIMOS = 30;
export const SEGUNDOS_POR_DEFECTO = 5;

export function segundosValidos(segundos: number): boolean {
  return Number.isInteger(segundos) && segundos >= SEGUNDOS_MINIMOS && segundos <= SEGUNDOS_MAXIMOS;
}

/** Las zonas IANA que conoce el navegador, con las de Bolivia y la región primero. */
export function zonasHorarias(): string[] {
  const todas = Intl.supportedValuesOf('timeZone');
  const primeras = [ZONA_POR_DEFECTO, 'America/Lima', 'America/Santiago', 'America/Sao_Paulo'];
  return [...new Set([...primeras.filter((z) => todas.includes(z)), ...todas])];
}
