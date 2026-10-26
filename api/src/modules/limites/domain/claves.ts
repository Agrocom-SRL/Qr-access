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
 * Dónde puede tener excepción una clave: `usuario` = para una cuenta o para un usuario; `cuenta` = solo para
 * una cuenta entera (la bolsa es de la cuenta); `global` = ninguna, vale igual para todos.
 */
export type AlcanceDeExcepcion = 'usuario' | 'cuenta' | 'global';

export interface DefinicionDeClave {
  readonly clave: ClaveDeLimite;
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

export const CLAVES_DE_LIMITE: readonly ClaveDeLimite[] = DEFINICIONES.map((d) => d.clave);

/** La definición de una clave, o `null` si no existe (un texto cualquiera que llegó por la API). */
export function definicionDe(clave: string): DefinicionDeClave | null {
  return DEFINICIONES.find((definicion) => definicion.clave === clave) ?? null;
}

export function todasLasDefiniciones(): readonly DefinicionDeClave[] {
  return DEFINICIONES;
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
