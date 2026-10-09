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
