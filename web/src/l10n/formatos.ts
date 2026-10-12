/** Formatos con `Intl` según el idioma activo (README del handoff, "Formato"). */
const LOCALES: Readonly<Record<string, string>> = { es: 'es-BO', en: 'en-US' };

function localeDe(idioma: string): string {
  return LOCALES[idioma] ?? LOCALES.es ?? 'es-BO';
}

/** `Bs 12.000`: moneda boliviana, sin decimales y punto como separador de miles. */
export function formatearMonto(monto: number, idioma = 'es'): string {
  const numero = new Intl.NumberFormat(localeDe(idioma), {
    maximumFractionDigits: 0,
    useGrouping: true,
  })
    .format(monto)
    .replaceAll(/\p{Z}/gu, '.');
  return `Bs ${numero}`;
}

/** `dd/mm/aaaa`, siempre en la zona horaria dada (por defecto La Paz; invariante 7). */
export function formatearFecha(
  fecha: Date | string,
  idioma = 'es',
  zona = 'America/La_Paz',
): string {
  return new Intl.DateTimeFormat(localeDe(idioma), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: zona,
  }).format(new Date(fecha));
}

/** `HH:mm` de 24 horas. */
export function formatearHora(
  fecha: Date | string,
  idioma = 'es',
  zona = 'America/La_Paz',
): string {
  return new Intl.DateTimeFormat(localeDe(idioma), {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: zona,
  }).format(new Date(fecha));
}
