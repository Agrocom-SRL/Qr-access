/**
 * Escritura de CSV segura para las exportaciones (ADR 0033 §3, ola W11). Puro: no toca la base.
 *
 * Dos peligros, dos defensas:
 * - **Inyección de fórmulas.** Quien abre el archivo en una planilla ejecuta cualquier celda que empiece con `=`, `+`,
 *   `-` o `@` (y también con tabulador o retorno de carro). Los textos que pone una persona (la etiqueta de un QR, el
 *   nombre de un usuario o de una puerta, el motivo de un estado) llegan hasta acá, así que toda celda de TEXTO que
 *   pueda leerse como fórmula se antepone con un apóstrofo: la planilla la muestra como texto. Un número real
 *   (`number`) no es texto y no se toca: un `-5` legítimo sigue siendo `-5`.
 * - **Estructura.** Una celda con coma, comilla o salto de línea se encierra en comillas y las comillas se duplican
 *   (RFC 4180); si no, un texto podría correr las columnas o sumar filas.
 */

/** Un valor de celda: texto, número, booleano, fecha o vacío. */
export type Celda = string | number | boolean | Date | null | undefined;

/**
 * Empieza (tras espacios o saltos iniciales) con un carácter que una planilla toma por fórmula, incluidas las
 * variantes de ancho completo. También un tabulador o un retorno de carro al inicio.
 */
const COMIENZO_DE_FORMULA = /^[\t\r\n ]*[=+\-@＝＋－＠]|^[\t\r]/u;

/** El texto de una celda, ya neutralizado contra fórmulas y sin escapar de comillas. */
function textoSeguro(valor: Celda): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === 'number') return Number.isFinite(valor) ? String(valor) : '';
  if (typeof valor === 'boolean') return valor ? '1' : '0';
  return COMIENZO_DE_FORMULA.test(valor) ? `'${valor}` : valor;
}

/** Una celda lista para escribir: neutralizada y, si hace falta, entre comillas. */
export function celdaCsv(valor: Celda): string {
  const texto = textoSeguro(valor);
  return /[",\r\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

/** Un CSV completo con su encabezado: líneas separadas por `\r\n` (RFC 4180) y un salto final. */
export function armarCsv(
  encabezado: readonly string[],
  filas: readonly (readonly Celda[])[],
): string {
  const lineas = [encabezado, ...filas].map((fila) => fila.map(celdaCsv).join(','));
  return `${lineas.join('\r\n')}\r\n`;
}
