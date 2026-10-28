/**
 * Anulación masiva de los QR vigentes de una cuenta, para AGROCOM (ADR 0031 §3, ADR 0033 §3). Anular es
 * destructivo: un QR anulado no vuelve. Por eso la interfaz exige un motivo y que se escriba el código de la
 * cuenta antes de mandar nada. Sin cifras de límite: los QR son ilimitados (invariante 6 del proyecto).
 */

/** Permiso de ámbito plataforma para anular en bloque los QR de una cuenta (`db/seeds/01_catalogo.sql`). */
export const PERMISO_ANULAR_QR_DE_CUENTA = 'accesos.qr.anular_masivo_cuenta';

/** Largo máximo del motivo: lo mismo que la API (`anulaciones_masivas.motivo` es VARCHAR(200)). */
export const MAX_MOTIVO_DE_ANULACION = 200;

/** Lo que devuelve la API al anular: cuántos QR vigentes se anularon (0 si no había ninguno). */
export interface ResultadoDeAnulacion {
  id: string;
  usuariosAlcanzados: number;
  qrAnulados: number;
}

/** El motivo sin espacios sobrantes, o `null` si está vacío o se pasa del largo máximo. */
export function motivoDeAnulacion(texto: string): string | null {
  const limpio = texto.trim();
  if (limpio === '' || limpio.length > MAX_MOTIVO_DE_ANULACION) return null;
  return limpio;
}

/** Que lo escrito sea el código de la cuenta, sin importar mayúsculas ni espacios. Nunca vale un código vacío. */
export function confirmaCodigo(escrito: string, codigo: string): boolean {
  if (codigo === '') return false;
  return escrito.trim().toUpperCase() === codigo.toUpperCase();
}

/** Se puede confirmar la anulación: motivo válido y código de la cuenta escrito bien. */
export function puedeAnular(motivo: string, codigoEscrito: string, codigoCuenta: string): boolean {
  return motivoDeAnulacion(motivo) !== null && confirmaCodigo(codigoEscrito, codigoCuenta);
}
