/** Fecha en el formato del contrato: ISO 8601 UTC con `Z` (ADR 0005). */
export function aIso(fecha: Date): string {
  return fecha.toISOString();
}

export function aIsoONulo(fecha: Date | null): string | null {
  return fecha === null ? null : fecha.toISOString();
}

export function sumarMinutos(fecha: Date, minutos: number): Date {
  return new Date(fecha.getTime() + minutos * 60_000);
}

export function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * 86_400_000);
}

/** Diferencia (ms) entre la hora de pared de `zona` y UTC en el instante `instante`. */
function desfaseDeZona(instante: number, zona: string): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(instante));
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
  const local = Date.UTC(
    valor('year'),
    valor('month') - 1,
    valor('day'),
    valor('hour'),
    valor('minute'),
    valor('second'),
  );
  return local - Math.floor(instante / 1000) * 1000;
}

/** La medianoche de `aaaa-mm-dd` en `zona`, como instante UTC (las fechas se guardan en UTC, invariante 7). */
export function inicioDelDia(fecha: string, zona = 'America/La_Paz'): Date {
  const [anio = 0, mes = 1, dia = 1] = fecha.split('-').map(Number);
  const medianocheUtc = Date.UTC(anio, mes - 1, dia);
  return new Date(medianocheUtc - desfaseDeZona(medianocheUtc, zona));
}

/** Suma meses de calendario (en UTC) sin pasarse de fin de mes: 31/01 + 1 mes = 28 o 29/02. */
export function sumarMeses(fecha: Date, meses: number): Date {
  const resultado = new Date(fecha.getTime());
  const dia = resultado.getUTCDate();
  resultado.setUTCDate(1);
  resultado.setUTCMonth(resultado.getUTCMonth() + meses);
  const ultimoDia = new Date(
    Date.UTC(resultado.getUTCFullYear(), resultado.getUTCMonth() + 1, 0),
  ).getUTCDate();
  resultado.setUTCDate(Math.min(dia, ultimoDia));
  return resultado;
}
