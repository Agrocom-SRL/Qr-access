import { LATIDO_MAXIMO_SEGUNDOS } from './en-linea.js';

/**
 * Los estados de una placa derivados de su latido (ADR 0031 §18). Puro: recibe el reloj y los umbrales, no toca
 * la base, así se prueba con casos escritos a mano.
 *
 * - `en_linea`: último latido de hace menos de 180 s (`estaEnLinea`).
 * - `sin_conexion`: entre 180 s y los 15 min; se muestra, SIN aviso (un corte breve se resuelve solo).
 * - `caida_sostenida`: 15 min sin latido; aviso a AGROCOM y al propietario.
 * - `desaparecida`: 2 h sin latido; aviso a AGROCOM.
 * Una placa que nunca envió un latido no tiene estado (`null`): no genera aviso.
 */
export type EstadoDeConexion = 'en_linea' | 'sin_conexion' | 'caida_sostenida' | 'desaparecida';
export type EstadoDeLector = 'responde' | 'sin_respuesta';

export interface UmbralesDePlaca {
  readonly caidaSegundos: number;
  readonly desaparecidaSegundos: number;
  /** Cuánto debe sostenerse la racha de latidos (o del lector respondiendo) para dar por recuperada la placa. */
  readonly recuperacionSegundos: number;
  readonly lectorSinRespuestaSegundos: number;
  readonly observacionSegundos: number;
}

export interface EntradaDeConexion {
  readonly ultimoLatidoAt: Date | null;
  /** Desde cuándo la racha actual de latidos es continua. */
  readonly enLineaDesde: Date | null;
  /** El estado que quedó guardado en la pasada anterior. */
  readonly previo: EstadoDeConexion | null;
}

const esAlerta = (estado: EstadoDeConexion | null): boolean =>
  estado === 'caida_sostenida' || estado === 'desaparecida';

/**
 * El estado de conexión ahora, con histéresis: una placa que ya está en alerta NO vuelve a `en_linea` por un
 * latido suelto, sino cuando lleva una racha continua de latidos de al menos `recuperacionSegundos`; y mientras
 * no se recupera no baja de escalón (de `desaparecida` a `caida_sostenida`), para que un enlace inestable no abra
 * y cierre avisos en cada parpadeo.
 */
export function evaluarConexion(
  entrada: EntradaDeConexion,
  ahora: Date,
  umbrales: UmbralesDePlaca,
): EstadoDeConexion | null {
  const { ultimoLatidoAt, enLineaDesde, previo } = entrada;
  if (ultimoLatidoAt === null) return null;
  const silencio = (ahora.getTime() - ultimoLatidoAt.getTime()) / 1000;

  if (silencio <= LATIDO_MAXIMO_SEGUNDOS) {
    if (!esAlerta(previo)) return 'en_linea';
    const racha = enLineaDesde === null ? 0 : (ahora.getTime() - enLineaDesde.getTime()) / 1000;
    return racha >= umbrales.recuperacionSegundos ? 'en_linea' : previo;
  }
  if (silencio >= umbrales.desaparecidaSegundos || previo === 'desaparecida') return 'desaparecida';
  if (silencio >= umbrales.caidaSegundos || previo === 'caida_sostenida') return 'caida_sostenida';
  return 'sin_conexion';
}

export interface EntradaDeLector {
  /** Lo que informó el último latido; `null` si el firmware no lo informa. */
  readonly lectorResponde: boolean | null;
  /** Desde cuándo informa ese valor. */
  readonly lectorCambioAt: Date | null;
  readonly previo: EstadoDeLector | null;
}

/**
 * Lector sin respuesta: el latido dice que no responde por UART y lleva así más de `lectorSinRespuestaSegundos`
 * (unos minutos, no 24 h: con el lector caído la puerta no puede leer). También con histéresis: para dar el lector
 * por recuperado debe llevar `recuperacionSegundos` respondiendo.
 */
export function evaluarLector(
  entrada: EntradaDeLector,
  ahora: Date,
  umbrales: UmbralesDePlaca,
): EstadoDeLector | null {
  const { lectorResponde, lectorCambioAt, previo } = entrada;
  if (lectorResponde === null) return null;
  const desde = lectorCambioAt === null ? 0 : (ahora.getTime() - lectorCambioAt.getTime()) / 1000;
  if (!lectorResponde) {
    return desde >= umbrales.lectorSinRespuestaSegundos || previo === 'sin_respuesta'
      ? 'sin_respuesta'
      : 'responde';
  }
  return previo === 'sin_respuesta' && desde < umbrales.recuperacionSegundos
    ? 'sin_respuesta'
    : 'responde';
}

/** Horas latiendo sin informar el lector tras las cuales lo guardado se da por obsoleto. */
export const LECTOR_OBSOLETO_HORAS = 6;

/**
 * ¿Lo que se guardó del lector quedó obsoleto? Pasa cuando la placa SIGUE latiendo pero hace horas que ya no lo
 * informa (un firmware que dejó de hacerlo): sin esto, un `sin_respuesta` viejo mantendría abierto su aviso para
 * siempre. Se mide con los latidos recibidos, no con el reloj: una placa caída no deja obsoleto su lector, para
 * eso ya está el aviso de conexión.
 */
export function lectorObsoleto(datos: {
  readonly lectorResponde: boolean | null;
  readonly lectorInformadoAt: Date | null;
  readonly ultimoLatidoAt: Date | null;
}): boolean {
  const { lectorResponde, lectorInformadoAt, ultimoLatidoAt } = datos;
  if (lectorResponde === null || lectorInformadoAt === null || ultimoLatidoAt === null)
    return false;
  return ultimoLatidoAt.getTime() - lectorInformadoAt.getTime() >= LECTOR_OBSOLETO_HORAS * 3600_000;
}

/**
 * En observación: la placa está en línea pero la puerta no tuvo ninguna lectura en el plazo. Es una marca
 * informativa para el panel, sin aviso (una puerta de poco tráfico es normal). Una placa recién vinculada se
 * mide desde que se vinculó, no desde siempre.
 */
export function estaEnObservacion(
  datos: {
    readonly conexion: EstadoDeConexion | null;
    readonly ultimaLecturaAt: Date | null;
    readonly vinculadaAt: Date;
  },
  ahora: Date,
  umbrales: UmbralesDePlaca,
): boolean {
  if (datos.conexion !== 'en_linea') return false;
  const referencia =
    datos.ultimaLecturaAt !== null && datos.ultimaLecturaAt > datos.vinculadaAt
      ? datos.ultimaLecturaAt
      : datos.vinculadaAt;
  return (ahora.getTime() - referencia.getTime()) / 1000 >= umbrales.observacionSegundos;
}

/** Los tres grupos por los que se avisa. Una placa puede estar en varios a la vez. */
export const GRUPOS_DE_AVISO = [
  'placa.caida_sostenida',
  'placa.desaparecida',
  'placa.lector_sin_respuesta',
] as const;
export type GrupoDeAviso = (typeof GRUPOS_DE_AVISO)[number];

export interface PlacaParaAgrupar {
  readonly id: string;
  readonly sitioId: string;
  readonly conexion: EstadoDeConexion | null;
  readonly lector: EstadoDeLector | null;
}

/** ¿La placa pertenece a este grupo? La desaparecida también es una caída sostenida (la puerta no lee QR). */
export function perteneceAlGrupo(placa: PlacaParaAgrupar, grupo: GrupoDeAviso): boolean {
  switch (grupo) {
    case 'placa.caida_sostenida':
      return placa.conexion === 'caida_sostenida' || placa.conexion === 'desaparecida';
    case 'placa.desaparecida':
      return placa.conexion === 'desaparecida';
    case 'placa.lector_sin_respuesta':
      return placa.lector === 'sin_respuesta';
  }
}

/** La clave del grupo: un tipo de aviso en un sitio. Un aviso agrupado por sitio, no uno por placa. */
export function claveDeGrupo(grupo: GrupoDeAviso, sitioId: string): string {
  return `${grupo}:sitio:${sitioId}`;
}

/** `clave del grupo -> ids de sus placas` (ordenados), solo los grupos con al menos una placa. */
export function miembrosPorGrupo(placas: readonly PlacaParaAgrupar[]): Map<string, string[]> {
  const resultado = new Map<string, string[]>();
  for (const placa of placas) {
    for (const grupo of GRUPOS_DE_AVISO) {
      if (!perteneceAlGrupo(placa, grupo)) continue;
      const clave = claveDeGrupo(grupo, placa.sitioId);
      resultado.set(clave, [...(resultado.get(clave) ?? []), placa.id]);
    }
  }
  for (const ids of resultado.values()) ids.sort((a, b) => Number(a) - Number(b));
  return resultado;
}

/** Las claves cuyos miembros cambiaron entre dos fotografías (aparecen, crecen, menguan o desaparecen). */
export function gruposQueCambiaron(
  antes: ReadonlyMap<string, readonly string[]>,
  ahora: ReadonlyMap<string, readonly string[]>,
): string[] {
  const claves = new Set([...antes.keys(), ...ahora.keys()]);
  return [...claves]
    .filter((clave) => (antes.get(clave) ?? []).join(',') !== (ahora.get(clave) ?? []).join(','))
    .sort();
}

/** Lo inverso de `claveDeGrupo`. */
export function descomponerClave(clave: string): { grupo: GrupoDeAviso; sitioId: string } | null {
  const [grupo, sitioId] = clave.split(':sitio:');
  const conocido = GRUPOS_DE_AVISO.find((g) => g === grupo);
  return conocido === undefined || sitioId === undefined ? null : { grupo: conocido, sitioId };
}
