/** Etiquetas de los ejes y de la tabla, siempre en el idioma activo. */

/** `2026-10` → "oct" (o "oct 26" si `conAnio`), con la zona UTC para que el día 1 no caiga en el mes anterior. */
export function etiquetaDeMes(mes: string, idioma: string, conAnio = false): string {
  const [anio = 0, numero = 1] = mes.split('-').map(Number);
  return new Intl.DateTimeFormat(idioma, {
    month: 'short',
    ...(conAnio ? { year: '2-digit' } : {}),
    timeZone: 'UTC',
  })
    .format(new Date(Date.UTC(anio, numero - 1, 1)))
    .replace('.', '');
}

/** `2026-10-12` → "12/10" (día/mes) en el formato del idioma. */
export function etiquetaDeDia(dia: string, idioma: string): string {
  const [anio = 0, mes = 1, numero = 1] = dia.split('-').map(Number);
  return new Intl.DateTimeFormat(idioma, {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(anio, mes - 1, numero)));
}

/** Montos compactos para el eje (`12 mil`, `1,2 M`). */
export function montoCompacto(valor: number, idioma: string): string {
  return new Intl.NumberFormat(idioma, { notation: 'compact', maximumFractionDigits: 1 }).format(
    valor,
  );
}
