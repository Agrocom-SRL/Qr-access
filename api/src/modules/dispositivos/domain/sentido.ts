/**
 * Dónde está el lector de una placa respecto de la puerta (ADR 0035 §4): `entrada` (lado de afuera), `salida` (lado
 * de adentro) o `ambos` (una sola placa para los dos lados; es el valor por omisión). No interviene en la apertura
 * manual ni en la validación de un QR: solo decide cuántas placas puede llevar una puerta. Puro: no toca la base.
 */
export const SENTIDOS = ['entrada', 'salida', 'ambos'] as const;
export type Sentido = (typeof SENTIDOS)[number];

export const SENTIDO_POR_OMISION: Sentido = 'ambos';

/** Por qué una placa nueva no cabe en la puerta: ya hay otra en ese lado, o `ambos` se estaría mezclando. */
export type ConflictoDeSentido = 'mismo_sentido' | 'sentido_en_conflicto';

/**
 * Una puerta admite como máximo una placa en servicio por ubicación de lector, y `ambos` es exclusivo: no
 * convive con `entrada` ni con `salida`. La restricción única de la base cubre el primer caso; el segundo no se
 * puede expresar con un índice y lo hace cumplir la acción de vincular, dentro de su transacción.
 *
 * @param existentes sentidos de las placas ya en servicio en la puerta.
 * @returns el conflicto, o `null` si la placa nueva cabe.
 */
export function conflictoDeSentido(
  existentes: readonly Sentido[],
  nuevo: Sentido,
): ConflictoDeSentido | null {
  if (existentes.includes(nuevo)) return 'mismo_sentido';
  const mezcla = nuevo === 'ambos' ? existentes.length > 0 : existentes.includes('ambos');
  return mezcla ? 'sentido_en_conflicto' : null;
}
