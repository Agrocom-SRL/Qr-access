/**
 * Las claves de los topes de generación de QR (ADR 0030 §2 y §7, ADR 0031 §9) y lo que cada una admite.
 * Este archivo NO guarda valores: el valor vigente de cada clave vive en la tabla `configuracion_limites`,
 * que AGROCOM edita (los iniciales los siembra la migración). Aquí solo está el catálogo: qué claves existen,
 * entre qué extremos se pueden fijar y dónde puede haber una excepción. Puro: no toca la base.
 */

export const CLAVES = {
  topeDiario: 'qr.tope_diario',
  topePendientes: 'qr.tope_pendientes',
  reemplazosSinUsoPorDia: 'qr.reemplazos_sin_uso_por_dia',
  esperaReemplazoSegundos: 'qr.espera_reemplazo_segundos',
  maxPuertasPorQr: 'qr.max_puertas_por_qr',
  bolsaMensual: 'qr.bolsa_mensual',
  bolsaAvisoPorcentaje: 'qr.bolsa_aviso_porcentaje',
} as const;

export type ClaveDeLimite = (typeof CLAVES)[keyof typeof CLAVES];

/**
 * Los umbrales de los estados de placa (ADR 0031 §18). Viven en la misma tabla y se editan por la misma ruta que los
 * topes de QR, pero son globales (sin excepción por cuenta) y no entran en los topes de generación.
 */
export const CLAVES_DE_PLACA = {
  caidaMinutos: 'placa.caida_minutos',
  desaparecidaMinutos: 'placa.desaparecida_minutos',
  recuperacionMinutos: 'placa.recuperacion_minutos',
  lectorMinutos: 'placa.lector_minutos',
  observacionHoras: 'placa.observacion_horas',
} as const;

export type ClaveDePlaca = (typeof CLAVES_DE_PLACA)[keyof typeof CLAVES_DE_PLACA];

/**
 * Dónde puede tener excepción una clave: `usuario` = para una cuenta o para un usuario; `cuenta` = solo para
 * una cuenta entera (la bolsa es de la cuenta); `global` = ninguna, vale igual para todos.
 */
export type AlcanceDeExcepcion = 'usuario' | 'cuenta' | 'global';

export interface DefinicionDeClave {
  readonly clave: ClaveDeLimite | ClaveDePlaca;
  readonly minimo: number;
  readonly maximo: number;
  readonly excepcion: AlcanceDeExcepcion;
}

const DEFINICIONES: readonly DefinicionDeClave[] = [
  { clave: CLAVES.topeDiario, minimo: 1, maximo: 100_000, excepcion: 'usuario' },
  { clave: CLAVES.topePendientes, minimo: 1, maximo: 100_000, excepcion: 'usuario' },
  { clave: CLAVES.reemplazosSinUsoPorDia, minimo: 0, maximo: 1_000, excepcion: 'usuario' },
  { clave: CLAVES.esperaReemplazoSegundos, minimo: 0, maximo: 86_400, excepcion: 'usuario' },
  { clave: CLAVES.maxPuertasPorQr, minimo: 1, maximo: 1_000, excepcion: 'usuario' },
  { clave: CLAVES.bolsaMensual, minimo: 1, maximo: 100_000_000, excepcion: 'cuenta' },
  { clave: CLAVES.bolsaAvisoPorcentaje, minimo: 1, maximo: 100, excepcion: 'global' },
];

const DEFINICIONES_DE_PLACA: readonly DefinicionDeClave[] = [
  { clave: CLAVES_DE_PLACA.caidaMinutos, minimo: 1, maximo: 1_440, excepcion: 'global' },
  { clave: CLAVES_DE_PLACA.desaparecidaMinutos, minimo: 2, maximo: 10_080, excepcion: 'global' },
  { clave: CLAVES_DE_PLACA.recuperacionMinutos, minimo: 1, maximo: 60, excepcion: 'global' },
  { clave: CLAVES_DE_PLACA.lectorMinutos, minimo: 1, maximo: 1_440, excepcion: 'global' },
  { clave: CLAVES_DE_PLACA.observacionHoras, minimo: 1, maximo: 720, excepcion: 'global' },
];

/** Los topes de generación de QR (no incluye los umbrales de placa). */
export const CLAVES_DE_LIMITE: readonly ClaveDeLimite[] = Object.values(CLAVES);

/** La definición de una clave, o `null` si no existe (un texto cualquiera que llegó por la API). */
export function definicionDe(clave: string): DefinicionDeClave | null {
  return todasLasDefiniciones().find((definicion) => definicion.clave === clave) ?? null;
}

export function todasLasDefiniciones(): readonly DefinicionDeClave[] {
  return [...DEFINICIONES, ...DEFINICIONES_DE_PLACA];
}

/** ¿`valor` es un entero dentro de los extremos de la clave? */
export function valorValido(definicion: DefinicionDeClave, valor: number): boolean {
  return Number.isInteger(valor) && valor >= definicion.minimo && valor <= definicion.maximo;
}

/**
 * El valor que rige: la excepción del usuario, si no la de su cuenta, si no lo que fija su plan (solo la
 * bolsa y las puertas por QR), si no el valor global.
 */
export function valorEfectivo(valores: {
  readonly deUsuario: number | null;
  readonly deCuenta: number | null;
  readonly dePlan: number | null;
  readonly global: number;
}): number {
  return valores.deUsuario ?? valores.deCuenta ?? valores.dePlan ?? valores.global;
}
