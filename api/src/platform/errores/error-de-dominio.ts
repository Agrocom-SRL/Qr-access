/**
 * Error esperado del dominio. La API responde su `code` (p. ej. `qr.vencido`), nunca una
 * frase: la app lo traduce (ADR 0013). `extra` va en el cuerpo del problema y no debe
 * llevar secretos.
 */
export class ErrorDeDominio extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly extra: Readonly<Record<string, unknown>> = {},
  ) {
    super(code);
    this.name = 'ErrorDeDominio';
  }
}
