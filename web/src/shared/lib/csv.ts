/** Una celda de CSV: se encomilla si lleva coma, comilla o salto de línea (RFC 4180). */
export function celdaCsv(valor: string | number): string {
  const texto = String(valor);
  return /[",\n\r]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}
