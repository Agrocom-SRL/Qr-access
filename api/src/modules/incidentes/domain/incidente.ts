/**
 * Incidentes de uso y reincidencia (ADR 0033 §4, ola W11). Puro: no toca la base.
 *
 * Un incidente es un HECHO (qué se sospecha de un usuario); lo que se decide después es otra cosa (la resolución).
 * Un incidente aislado nunca limita nada: solo la REINCIDENCIA (varios CONFIRMADOS dentro de una ventana móvil)
 * hace que el sistema proponga un paso, y el paso crítico lo decide siempre una persona.
 */

export const TIPOS_DE_INCIDENTE = [
  'uso_masivo',
  'uso_imposible',
  'pin_compartido',
  'qr_reenviado',
  'generacion_ruidosa',
  'perdida_o_robo',
  'otro',
] as const;
export type TipoDeIncidente = (typeof TIPOS_DE_INCIDENTE)[number];

export const GRAVEDADES = ['baja', 'media', 'alta'] as const;
export type Gravedad = (typeof GRAVEDADES)[number];

export const ORIGENES = ['sistema', 'persona'] as const;
export type OrigenDeIncidente = (typeof ORIGENES)[number];

export const RESULTADOS = ['descartado', 'confirmado', 'pendiente'] as const;
export type ResultadoDeResolucion = (typeof RESULTADOS)[number];

/** El estado de un incidente: sin resolver todavía o el resultado de su última resolución. */
export type EstadoDeIncidente = 'sin_resolver' | ResultadoDeResolucion;

/** Cuántos ids de cada clase puede llevar la evidencia: acota el JSON que se guarda. */
export const MAX_IDS_DE_EVIDENCIA = 50;

/**
 * La evidencia de un incidente: SOLO ids (de los QR, de los intentos de acceso y de los rechazos de generación).
 * Jamás el token del QR ni su hash (invariante 6).
 */
export interface Evidencia {
  readonly qr_ids: string[];
  readonly evento_acceso_ids: string[];
  readonly evento_limite_ids: string[];
}

export const EVIDENCIA_VACIA: Evidencia = {
  qr_ids: [],
  evento_acceso_ids: [],
  evento_limite_ids: [],
};

/** Evidencia con solo algunas de las listas (las que falten se toman vacías). */
export interface EvidenciaParcial {
  readonly qr_ids?: readonly string[] | undefined;
  readonly evento_acceso_ids?: readonly string[] | undefined;
  readonly evento_limite_ids?: readonly string[] | undefined;
}

/** Quita repetidos y deja la evidencia en su forma completa (las tres listas). */
export function normalizarEvidencia(parcial: EvidenciaParcial | undefined): Evidencia {
  const unicos = (ids: readonly string[] | undefined): string[] => [...new Set(ids ?? [])];
  return {
    qr_ids: unicos(parcial?.qr_ids),
    evento_acceso_ids: unicos(parcial?.evento_acceso_ids),
    evento_limite_ids: unicos(parcial?.evento_limite_ids),
  };
}

/** Lo que el sistema propone hacer con un reincidente (ADR 0033 §4.3). */
export const ACCIONES_PROPUESTAS = ['restringir', 'suspender', 'suspender_y_anular'] as const;
export type AccionPropuesta = (typeof ACCIONES_PROPUESTAS)[number];

export interface EntradaDeReincidencia {
  /** El tipo del incidente que acaba de confirmarse. */
  readonly tipoConfirmado: TipoDeIncidente;
  /** Incidentes confirmados del usuario dentro de la ventana, INCLUIDO el que acaba de confirmarse. */
  readonly confirmadosEnVentana: number;
  /** A partir de cuántos confirmados hay reincidencia. */
  readonly minimo: number;
  /** El estado PROPIO del usuario hoy. */
  readonly estadoPropio: 'activo' | 'restringido' | 'suspendido';
}

/**
 * Qué paso proponer al confirmarse un incidente, o `null` si ninguno (ADR 0033 §4.3):
 * - ya suspendido: no hay nada más grave que proponer;
 * - `perdida_o_robo` confirmado: suspender y anular sus QR vigentes, de inmediato (sin esperar el umbral);
 * - menos confirmados que el umbral: ninguno, un incidente aislado nunca limita nada;
 * - reincidencia estando restringido: suspender;
 * - 1.ª reincidencia (activo): restringir.
 * NUNCA devuelve algo que el sistema aplique solo salvo `restringir`, y eso solo si la cuenta lo habilitó (lo decide
 * quien llama): el nivel crítico (`suspender`, `suspender_y_anular`) lo aplica siempre una persona.
 */
export function proponerAccion(entrada: EntradaDeReincidencia): AccionPropuesta | null {
  if (entrada.estadoPropio === 'suspendido') return null;
  if (entrada.tipoConfirmado === 'perdida_o_robo') return 'suspender_y_anular';
  if (entrada.confirmadosEnVentana < entrada.minimo) return null;
  return entrada.estadoPropio === 'restringido' ? 'suspender' : 'restringir';
}

/** ¿La cuenta puede dejar que el sistema aplique esta acción sin una persona? Solo el nivel leve, y si lo habilitó. */
export function puedeAplicarseSola(
  accion: AccionPropuesta,
  restriccionAutomatica: boolean,
  nivelDelUsuario: string | null,
): boolean {
  // Un Administrador restringido arrastraría a toda su rama: un falso positivo dejaría a la cuenta sin funcionar.
  return restriccionAutomatica && accion === 'restringir' && nivelDelUsuario !== 'administrador';
}

/** Clave de agrupación del aviso de una propuesta: una abierta por usuario y paso. */
export function agrupacionDePropuesta(usuarioId: string, accion: AccionPropuesta): string {
  return `incidente.propuesta:usuario:${usuarioId}:${accion}`;
}

/** Motivo que lleva el estado que el sistema impone (un código estable, que la app traduce; no es texto de nadie). */
export const MOTIVO_DE_RESTRICCION_AUTOMATICA = 'incidente.reincidencia';

/** Clave de idempotencia de un incidente `generacion_ruidosa` del sistema: uno por usuario y día (UTC). */
export function claveDeGeneracionRuidosa(usuarioId: string, ahora: Date): string {
  return `generacion_ruidosa:${usuarioId}:${ahora.toISOString().slice(0, 10)}`;
}
