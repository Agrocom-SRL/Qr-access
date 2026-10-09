const ZONA_DE_RESPALDO = 'America/La_Paz';

interface PartesLocales {
  anio: number;
  mes: number;
  dia: number;
}

function formateador(zonaHoraria: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
}

function partesDe(formato: Intl.DateTimeFormat, instante: Date): Record<string, number> {
  const partes: Record<string, number> = {};
  for (const parte of formato.formatToParts(instante)) {
    if (parte.type !== 'literal') partes[parte.type] = Number(parte.value);
  }
  return partes;
}

/** Cuánto se adelanta la hora local de la zona respecto de UTC en ese instante, en ms. */
function desfaseEnMs(formato: Intl.DateTimeFormat, instante: Date): number {
  const p = partesDe(formato, instante);
  const comoUtc = Date.UTC(p.year ?? 0, (p.month ?? 1) - 1, p.day ?? 1, p.hour, p.minute, p.second);
  return comoUtc - Math.floor(instante.getTime() / 1000) * 1000;
}

/**
 * El instante (UTC) en que empieza el día siguiente en esa zona IANA: el "fin del día local"
 * del sitio (RF-05, invariante 7). Considera cambios de horario de verano.
 */
export function finDelDiaLocal(ahora: Date, zonaHoraria: string): Date {
  const formato = formateador(zonaHoraria);
  const p = partesDe(formato, ahora);
  const local: PartesLocales = { anio: p.year ?? 0, mes: p.month ?? 1, dia: p.day ?? 1 };
  const medianocheComoUtc = Date.UTC(local.anio, local.mes - 1, local.dia + 1, 0, 0, 0);
  // Dos pasadas: el desfase se mide en el instante buscado, que puede cruzar un cambio de hora.
  const primera = medianocheComoUtc - desfaseEnMs(formato, new Date(medianocheComoUtc));
  return new Date(medianocheComoUtc - desfaseEnMs(formato, new Date(primera)));
}

/** Techo del sistema para cualquier QR, aunque el plan no limite la vigencia (7 días). */
export const VIGENCIA_MAXIMA_HORAS = 168;

export interface EntradaDeVencimiento {
  readonly ahora: Date;
  /** Zonas de los sitios de las puertas del QR. */
  readonly zonasHorarias: readonly string[];
  /** `null` = el plan no limita la vigencia (rige el techo del sistema). */
  readonly maxVigenciaHoras: number | null;
}

/**
 * El mayor vencimiento que una persona puede pedir para un QR: el límite de su plan, sin pasar
 * nunca el techo del sistema ([VIGENCIA_MAXIMA_HORAS]). Invariante 3: nunca más que el máximo
 * del plan.
 */
export function vencimientoMaximo({ ahora, maxVigenciaHoras }: EntradaDeVencimiento): Date {
  const horas =
    maxVigenciaHoras === null
      ? VIGENCIA_MAXIMA_HORAS
      : Math.min(maxVigenciaHoras, VIGENCIA_MAXIMA_HORAS);
  return new Date(ahora.getTime() + horas * 3_600_000);
}

/**
 * El vencimiento cuando la persona no pide uno: el fin del día local del sitio (el más próximo
 * si las puertas están en zonas distintas), sin pasar el máximo (ADR 0008 §3).
 */
export function vencimientoPorDefecto(entrada: EntradaDeVencimiento): Date {
  const zonas = entrada.zonasHorarias.length > 0 ? entrada.zonasHorarias : [ZONA_DE_RESPALDO];
  const finDelDia = Math.min(...zonas.map((zona) => finDelDiaLocal(entrada.ahora, zona).getTime()));
  return new Date(Math.min(finDelDia, vencimientoMaximo(entrada).getTime()));
}
