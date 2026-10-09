import type { Transaccion } from '../../../platform/db/transaccion.js';
import { hashear } from '../../../platform/seguridad/hash.js';
import { calcularIndiceDePin, generarSufijoDePin } from '../domain/pin.js';

/** Cuántos sorteos se intentan si el sufijo ya existe en la cuenta (36⁴ posibles: casi nunca). */
const INTENTOS_DE_SORTEO = 5;

export interface PinSorteado {
  /** Los 7 caracteres: lo único que se muestra, una sola vez. */
  readonly completo: string;
  readonly indice: string;
  readonly hash: string;
}

/** `true` si MySQL rechazó la fila por la unicidad del PIN dentro de la cuenta. */
function esSufijoRepetido(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY'
  );
}

/**
 * Sortea un PIN para la cuenta (ADR 0018 §1) y lo escribe con `guardar`; si el sufijo choca
 * con uno existente, sortea otro. El índice y el hash salen de acá; el texto nunca se persiste.
 */
export async function conPinNuevo(
  tx: Transaccion,
  cuenta: { readonly id: string; readonly codigo: string },
  pimienta: string,
  guardar: (pin: PinSorteado) => Promise<void>,
): Promise<string> {
  for (let intento = 1; ; intento += 1) {
    const sufijo = generarSufijoDePin();
    const completo = `${cuenta.codigo}${sufijo}`;
    const pin: PinSorteado = {
      completo,
      indice: calcularIndiceDePin(pimienta, cuenta.id, sufijo),
      hash: await hashear(completo),
    };
    try {
      await guardar(pin);
      return completo;
    } catch (error) {
      if (!esSufijoRepetido(error) || intento >= INTENTOS_DE_SORTEO) throw error;
    }
  }
}
