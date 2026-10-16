/** Une clases CSS descartando las vacías (`CSS Modules` devuelve `string | undefined` por índice). */
export function cx(...clases: readonly (string | false | null | undefined)[]): string {
  return clases.filter(Boolean).join(' ');
}
