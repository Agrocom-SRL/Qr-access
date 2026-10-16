import type { Transaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { hashear } from '../../../platform/seguridad/hash.js';
import { calcularIndiceDePin, generarSufijoDePin, secretoDePin } from '../domain/pin.js';

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
 * con uno existente, sortea otro. Con `sufijoElegido` (ADR 0028) usa ese: si ya existe, 409. El índice y el hash salen de acá; el texto nunca se persiste.
 */
export async function conPinNuevo(
  tx: Transaccion,
  cuenta: { readonly id: string; readonly codigo: string },
  pimienta: string,
  guardar: (pin: PinSorteado) => Promise<void>,
  sufijoElegido?: string,
): Promise<string> {
  for (let intento = 1; ; intento += 1) {
    const sufijo = sufijoElegido ?? generarSufijoDePin();
    const completo = `${cuenta.codigo}${sufijo}`;
    const pin: PinSorteado = {
      completo,
      indice: calcularIndiceDePin(pimienta, cuenta.id, sufijo),
      hash: await hashear(secretoDePin(cuenta.id, sufijo)),
    };
    try {
      await guardar(pin);
      return completo;
    } catch (error) {
      if (!esSufijoRepetido(error)) throw error;
      // Uno elegido a mano no se re-sortea: el administrador tiene que elegir otro.
      if (sufijoElegido !== undefined) throw new ErrorDeDominio('pin.sufijo_en_uso', 409);
      if (intento >= INTENTOS_DE_SORTEO) throw error;
    }
  }
}
