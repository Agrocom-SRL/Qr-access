export type MotivoDeRechazo =
  | 'qr.formato_invalido'
  | 'qr.desconocido'
  | 'qr.anulado'
  | 'qr.generador_suspendido'
  | 'qr.cuenta_suspendida'
  | 'qr.vencido'
  | 'qr.otra_puerta'
  | 'qr.usado'
  | 'suscripcion.vencida';

export const MOTIVO_PERMITIDO = 'acceso.permitido';

/**
 * Ventana de repetición de una apertura (ADR 0032 §3, decisión de Miguel: 15 s). Corta a propósito:
 * recupera la respuesta perdida de una lectura legítima sin ser una segunda oportunidad útil para
 * quien fotografió el QR.
 */
export const VENTANA_DE_REPETICION_MS = 15_000;

/**
 * Repeticiones permitidas por cada apertura original dentro de la ventana (ADR 0032 §3): una sola. Cubre
 * la respuesta perdida; una segunda relectura ya no es una respuesta perdida sino alguien insistiendo.
 */
export const MAX_REPETICIONES_POR_ORIGINAL = 1;

/** Ventana para enlazar un rechazo idéntico al primero y no llenar el registro de ruido (ADR 0032 §4.2). */
export const VENTANA_DE_RECHAZO_REPETIDO_MS = 60_000;

export interface QrParaDecidir {
  readonly anuladoAt: Date | null;
  readonly venceAt: Date;
  /** Puertas para las que se generó. */
  readonly puertaIds: readonly string[];
  /**
   * El estado efectivo de quien lo generó (ADR 0031 §2): el peor entre el suyo, el de sus superiores y el
   * de su cuenta. Suspendido o eliminado, el QR deja de abrir (RF-06); restringido, sigue abriendo.
   */
  readonly generador: EstadoDelGenerador;
}

/** Lo que la validación necesita del estado efectivo del generador. */
export interface EstadoDelGenerador {
  readonly estado: 'activo' | 'restringido' | 'suspendido' | 'eliminado';
  /** De dónde viene el estado cuando no es `activo`. */
  readonly origen: 'usuario' | 'superior' | 'cuenta' | null;
}

export interface EntradaDeDecision {
  readonly qr: QrParaDecidir;
  readonly puertaDelDispositivoId: string;
  readonly ahora: Date;
  readonly suscripcionVigente: boolean;
}

/**
 * El rechazo que corresponde al estado del generador, o `null` si el QR puede seguir. Restringido sigue
 * abriendo; un estado que no se reconoce no abre (falla cerrado).
 */
export function motivoPorEstadoDelGenerador(generador: EstadoDelGenerador): MotivoDeRechazo | null {
  switch (generador.estado) {
    case 'activo':
    case 'restringido':
      return null;
    case 'suspendido':
      return generador.origen === 'cuenta' ? 'qr.cuenta_suspendida' : 'qr.generador_suspendido';
    default:
      // `eliminado` y cualquier otro valor: como siempre, un QR sin dueño vigente está anulado.
      return 'qr.anulado';
  }
}

/**
 * Pasos 3 a 6 del ADR 0008, en ese orden. Devuelve el motivo del primer rechazo o `null` si
 * puede seguir al consumo atómico (paso 7, que es de la base y no de esta función pura).
 */
export function decidirAntesDeConsumir(entrada: EntradaDeDecision): MotivoDeRechazo | null {
  const { qr, puertaDelDispositivoId, ahora, suscripcionVigente } = entrada;
  if (qr.anuladoAt !== null) return 'qr.anulado';
  const motivoDelGenerador = motivoPorEstadoDelGenerador(qr.generador);
  if (motivoDelGenerador !== null) return motivoDelGenerador;
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
