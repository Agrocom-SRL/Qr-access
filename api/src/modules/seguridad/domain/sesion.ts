import { aIso } from '../../../platform/tiempo/fechas.js';

export interface VigenciaDeSesion {
  readonly revocada_at: Date | null;
  readonly expira_at: Date;
}

/** Una sesión sirve mientras no esté revocada ni vencida. */
export function sesionVigente(sesion: VigenciaDeSesion, ahora: Date): boolean {
  return sesion.revocada_at === null && sesion.expira_at > ahora;
}

/** Los tokens nuevos que entrega un refresco rotativo. */
export interface SesionRefrescada {
  acceso: string;
  refresco: string;
}

/** Desde dónde se abrió la sesión (ADR 0030 §4.1). `web` incluye la app web y el panel. */
export const PLATAFORMAS = ['android', 'ios', 'web'] as const;
export type Plataforma = (typeof PLATAFORMAS)[number];

/** Por qué se cerró una sesión; `null` en la base = cierres anteriores a W8 o por PIN regenerado, baja o suspensión. */
export const MOTIVOS_DE_CIERRE = [
  'salida',
  'propia',
  'superior',
  'plataforma',
  'misma_instalacion',
  'limite_usuario',
  'limite_instalacion',
] as const;
export type MotivoDeCierre = (typeof MOTIVOS_DE_CIERRE)[number];

/** Lo mínimo de una sesión viva para decidir cuáles se cierran al abrir otra. */
export interface SesionViva {
  readonly id: string;
  readonly instalacion_id: string | null;
  readonly ultima_actividad_at: Date | null;
  readonly created_at: Date;
}

export interface TopesDeSesiones {
  readonly maxPorUsuario: number;
  readonly maxPorInstalacion: number;
}

export interface CierreDeSesion {
  readonly id: string;
  readonly motivo: MotivoDeCierre;
}

function actividadDe(sesion: SesionViva): number {
  return (sesion.ultima_actividad_at ?? sesion.created_at).getTime();
}

/** La menos reciente primero; a igual momento, la de id menor (la más vieja). */
function masAntiguaPrimero(a: SesionViva, b: SesionViva): number {
  const diferencia = actividadDe(a) - actividadDe(b);
  if (diferencia !== 0) return diferencia;
  return BigInt(a.id) < BigInt(b.id) ? -1 : 1;
}

/**
 * Qué sesiones se cierran para abrir una nueva (ADR 0030 §4.1). Iniciar sesión NUNCA se rechaza: lo que
 * sobra es lo más antiguo.
 *  1. Una instalación tiene una sola sesión por usuario: volver a entrar desde el mismo aparato reemplaza la
 *     anterior (su refresh ya está en poder del propio aparato).
 *  2. Un usuario tiene a lo sumo `maxPorUsuario` sesiones vivas.
 *  3. Una instalación tiene a lo sumo `maxPorInstalacion` sesiones vivas (varios usuarios en un aparato).
 * Las sesiones sin instalación (clientes anteriores a W8) solo cuentan contra el tope por usuario.
 */
export function sesionesQueSobran(
  delUsuario: readonly SesionViva[],
  deLaInstalacion: readonly SesionViva[],
  nueva: { readonly instalacionId: string | null },
  topes: TopesDeSesiones,
): CierreDeSesion[] {
  const cierres: CierreDeSesion[] = [];
  const cerradas = new Set<string>();
  const cerrar = (sesion: SesionViva, motivo: MotivoDeCierre): void => {
    cerradas.add(sesion.id);
    cierres.push({ id: sesion.id, motivo });
  };

  if (nueva.instalacionId !== null) {
    for (const sesion of delUsuario) {
      if (sesion.instalacion_id === nueva.instalacionId) cerrar(sesion, 'misma_instalacion');
    }
  }

  const delUsuarioQueQuedan = delUsuario
    .filter((sesion) => !cerradas.has(sesion.id))
    .sort(masAntiguaPrimero);
  while (delUsuarioQueQuedan.length + 1 > topes.maxPorUsuario) {
    const masAntigua = delUsuarioQueQuedan.shift();
    if (masAntigua === undefined) break;
    cerrar(masAntigua, 'limite_usuario');
  }

  if (nueva.instalacionId !== null) {
    const enLaInstalacion = deLaInstalacion
      .filter((sesion) => !cerradas.has(sesion.id))
      .sort(masAntiguaPrimero);
    while (enLaInstalacion.length + 1 > topes.maxPorInstalacion) {
      const masAntigua = enLaInstalacion.shift();
      if (masAntigua === undefined) break;
      cerrar(masAntigua, 'limite_instalacion');
    }
  }
  return cierres;
}

/** El nombre del dispositivo sin caracteres de control ni espacios de más; `null` si no queda nada. */
export function nombreDeDispositivoLimpio(nombre: string | undefined | null): string | null {
  if (nombre === undefined || nombre === null) return null;
  const limpio = nombre
    // eslint-disable-next-line no-control-regex -- se descartan justamente los caracteres de control.
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return limpio === '' ? null : limpio;
}

/** Cada cuánto, como mucho, se escribe la última actividad de una sesión (evita un UPDATE por petición). */
export const INTERVALO_DE_ACTIVIDAD_MS = 5 * 60_000;

/** ¿Toca registrar actividad? Sí si nunca se registró o ya pasó el intervalo. */
export function debeRegistrarActividad(ultima: Date | null, ahora: Date): boolean {
  return ultima === null || ahora.getTime() - ultima.getTime() >= INTERVALO_DE_ACTIVIDAD_MS;
}

/** De dónde entra quien inicia sesión (ADR 0030 §4.1); todo es opcional: un cliente anterior a W8 no lo manda. */
export interface OrigenDeSesion {
  readonly instalacionId?: string | null;
  readonly plataforma?: Plataforma | null;
  /** Nombre corto del aparato o navegador, sin datos personales. */
  readonly dispositivo?: string | null;
}

/** Una sesión viva como la ve la API (ADR 0030 §4.1). Nunca lleva el refresh ni el identificador de instalación. */
export interface SesionAbierta {
  id: string;
  plataforma: Plataforma | null;
  /** Nombre corto del aparato o navegador que mandó la app; puede faltar. */
  dispositivo: string | null;
  ip: string | null;
  iniciada_at: string;
  ultima_actividad_at: string;
  expira_at: string;
  /** `true` si es la sesión con la que se hace esta petición. */
  actual: boolean;
}

export interface FilaDeSesionAbierta {
  readonly id: string;
  readonly plataforma: Plataforma | null;
  readonly nombre_dispositivo: string | null;
  readonly ip: string | null;
  readonly ultima_actividad_at: Date | null;
  readonly created_at: Date;
  readonly expira_at: Date;
}

export function presentarSesion(
  fila: FilaDeSesionAbierta,
  sesionActualId: string | null,
): SesionAbierta {
  return {
    id: fila.id,
    plataforma: fila.plataforma,
    dispositivo: fila.nombre_dispositivo,
    ip: fila.ip,
    iniciada_at: aIso(fila.created_at),
    ultima_actividad_at: aIso(fila.ultima_actividad_at ?? fila.created_at),
    expira_at: aIso(fila.expira_at),
    actual: fila.id === sesionActualId,
  };
}
