const ZONA_DE_RESPALDO = 'America/La_Paz';

/**
 * La zona en que se cuentan los días y los meses de los topes de generación (ADR 0030 §2). Un usuario no
 * tiene zona propia y sus puertas pueden estar en sitios distintos, así que cuenta la de la plataforma, que
 * es también la de respaldo de los sitios (invariante 7).
 */
export const ZONA_DE_LOS_TOPES = ZONA_DE_RESPALDO;

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

/**
 * El instante (UTC) en que empezó el día de `ahora` en esa zona: el comienzo de la ventana de «hoy» de los
 * topes diarios. Es el fin del día anterior, así que reutiliza el cálculo (y el cambio de hora) de
 * [finDelDiaLocal].
 */
export function inicioDelDiaLocal(ahora: Date, zonaHoraria: string): Date {
  // El fin del día de un instante de ayer es el comienzo de hoy. 24 h antes de `ahora` es de ayer salvo que un
  // cambio de hora alargue el día; entonces el candidato pasa de `ahora` y se retrocede otras 24 h.
  const candidato = finDelDiaLocal(new Date(ahora.getTime() - 24 * 3_600_000), zonaHoraria);
  if (candidato.getTime() <= ahora.getTime()) return candidato;
  return finDelDiaLocal(new Date(ahora.getTime() - 48 * 3_600_000), zonaHoraria);
}

/**
 * El instante (UTC) en que empezó el mes de `ahora` en esa zona: el comienzo de la ventana de la bolsa
 * mensual (ADR 0030 §2).
 */
export function inicioDelMesLocal(ahora: Date, zonaHoraria: string): Date {
  const formato = formateador(zonaHoraria);
  const p = partesDe(formato, ahora);
  const primeroComoUtc = Date.UTC(p.year ?? 0, (p.month ?? 1) - 1, 1, 0, 0, 0);
  const primera = primeroComoUtc - desfaseEnMs(formato, new Date(primeroComoUtc));
  return new Date(primeroComoUtc - desfaseEnMs(formato, new Date(primera)));
}

/** El día de `ahora` en esa zona como `aaaa-mm-dd` (sirve de clave de «una vez por día»). */
export function diaLocal(ahora: Date, zonaHoraria: string): string {
  const p = partesDe(formateador(zonaHoraria), ahora);
  return `${String(p.year)}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
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
