export type MotivoDeRechazo =
  | 'qr.formato_invalido'
  | 'qr.desconocido'
  | 'qr.anulado'
  | 'qr.vencido'
  | 'qr.otra_puerta'
  | 'qr.usado'
  | 'suscripcion.vencida';

export const MOTIVO_PERMITIDO = 'acceso.permitido';

export interface QrParaDecidir {
  readonly anuladoAt: Date | null;
  readonly venceAt: Date;
  /** Puertas para las que se emitió. */
  readonly puertaIds: readonly string[];
  /** ¿Quien lo emitió sigue activo? Con el emisor desactivado, el QR deja de abrir (RF-06). */
  readonly emisorActivo: boolean;
}

export interface EntradaDeDecision {
  readonly qr: QrParaDecidir;
  readonly puertaDelDispositivoId: string;
  readonly ahora: Date;
  readonly suscripcionVigente: boolean;
}

/**
 * Pasos 3 a 6 del ADR 0008, en ese orden. Devuelve el motivo del primer rechazo o `null` si
 * puede seguir al consumo atómico (paso 7, que es de la base y no de esta función pura).
 */
export function decidirAntesDeConsumir(entrada: EntradaDeDecision): MotivoDeRechazo | null {
  const { qr, puertaDelDispositivoId, ahora, suscripcionVigente } = entrada;
  if (qr.anuladoAt !== null || !qr.emisorActivo) return 'qr.anulado';
  if (qr.venceAt <= ahora) return 'qr.vencido';
  if (!qr.puertaIds.includes(puertaDelDispositivoId)) return 'qr.otra_puerta';
  if (!suscripcionVigente) return 'suscripcion.vencida';
  return null;
}

/**
 * El motivo cuando el consumo atómico no afectó ninguna fila: alguien más usó o anuló el QR
 * entre la lectura y el UPDATE. Ante la duda, `qr.usado`: nunca se abre.
 */
export function motivoTrasConsumoFallido(
  qr: { anuladoAt: Date | null; usadoAt: Date | null; venceAt: Date } | null,
  ahora: Date,
): MotivoDeRechazo {
  if (qr === null) return 'qr.desconocido';
  if (qr.anuladoAt !== null) return 'qr.anulado';
  if (qr.usadoAt !== null) return 'qr.usado';
  if (qr.venceAt <= ahora) return 'qr.vencido';
  return 'qr.usado';
}
