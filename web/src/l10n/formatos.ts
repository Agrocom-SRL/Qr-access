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

/** Cuenta regresiva `mm:ss` (A01b: "Ingresar en 04:32"). */
export function formatearCuentaRegresiva(segundos: number): string {
  const total = Math.max(0, Math.ceil(segundos));
  const minutos = Math.floor(total / 60);
  const resto = total % 60;
  return `${String(minutos).padStart(2, '0')}:${String(resto).padStart(2, '0')}`;
}

/** Día de `fecha` respecto de `ahora` en la zona dada: lo que decide "Hoy", "Ayer" o la fecha completa. */
export function relacionDeDia(
  fecha: Date | string,
  ahora: Date = new Date(),
  zona = 'America/La_Paz',
): 'hoy' | 'ayer' | 'otro' {
  const diaDe = (f: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: zona, dateStyle: 'short' }).format(f);
  const dia = diaDe(new Date(fecha));
  if (dia === diaDe(ahora)) return 'hoy';
  if (dia === diaDe(new Date(ahora.getTime() - 86_400_000))) return 'ayer';
  return 'otro';
}
