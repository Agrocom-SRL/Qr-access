export type EstadoDeQr = 'vigente' | 'usado' | 'vencido' | 'anulado';

export const ESTADOS_DE_QR: readonly EstadoDeQr[] = ['vigente', 'usado', 'vencido', 'anulado'];

export interface FechasDeQr {
  readonly anuladoAt: Date | null;
  readonly usadoAt: Date | null;
  readonly venceAt: Date;
}

/** Estado derivado, sin columna: anulado > usado > vencido > vigente. */
export function estadoDelQr(qr: FechasDeQr, ahora: Date): EstadoDeQr {
  if (qr.anuladoAt !== null) return 'anulado';
  if (qr.usadoAt !== null) return 'usado';
  if (qr.venceAt <= ahora) return 'vencido';
  return 'vigente';
}
