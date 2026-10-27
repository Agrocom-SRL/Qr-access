/**
 * La confirmación de la apertura (ADR 0031 §18): después de ordenar abrir, ¿la puerta se abrió? Puro: no toca la
 * base. La hora válida es siempre la del servidor; la placa solo cuenta lo que vio su sensor.
 */

/** Lo que el servidor guarda y muestra: el resultado de EJECUTAR la orden de abrir. */
export const EJECUCIONES = ['ejecutada', 'fallida', 'sin_confirmacion'] as const;
export type Ejecucion = (typeof EJECUCIONES)[number];

export const CAUSAS_DE_FALLA = ['puerta_no_abrio', 'puerta_no_cerro', 'rele_no_accionado'] as const;
export type CausaDeFalla = (typeof CAUSAS_DE_FALLA)[number];

export type CausaDeEjecucion = 'puerta_abrio' | CausaDeFalla | 'sin_sensor' | 'sin_respuesta';

export type OrigenDeConfirmacion = 'placa' | 'servidor';

/** Lo que informa la placa (`POST /dispositivos/confirmaciones`): `sin_sensor` si no tiene el contacto instalado. */
export type InformeDeLaPlaca =
  | { readonly resultado: 'ejecutada' }
  | { readonly resultado: 'fallida'; readonly causa: CausaDeFalla }
  | { readonly resultado: 'sin_sensor' };

export interface ResultadoDeEjecucion {
  readonly resultado: Ejecucion;
  readonly causa: CausaDeEjecucion;
}

/**
 * Del informe de la placa a lo que se guarda. Equivalencias con el ADR 0031 §18: `confirmada` = `ejecutada`,
 * `no_confirmada` = `fallida`, `sin_sensor` = `sin_confirmacion` por `sin_sensor` (no se inventa un éxito).
 */
export function resultadoDelInforme(informe: InformeDeLaPlaca): ResultadoDeEjecucion {
  switch (informe.resultado) {
    case 'ejecutada':
      return { resultado: 'ejecutada', causa: 'puerta_abrio' };
    case 'fallida':
      return { resultado: 'fallida', causa: informe.causa };
    case 'sin_sensor':
      return { resultado: 'sin_confirmacion', causa: 'sin_sensor' };
  }
}

/** La constancia del servidor cuando la placa no contestó en el plazo. */
export const SIN_RESPUESTA: ResultadoDeEjecucion = {
  resultado: 'sin_confirmacion',
  causa: 'sin_respuesta',
};

/**
 * Hasta cuándo se acepta una confirmación de la placa después de la apertura. Cubre el reintento de una placa que
 * perdió la red un momento; pasado el plazo ya no describe lo que pasó en la puerta (supuesto de la ola W10).
 */
export const CONFIRMACION_TARDIA_MAXIMA_MINUTOS = 10;

/** ¿Una falla de ejecución? Cuentan `fallida` y la falta de respuesta de una placa con sensor. */
export function esFalla(ejecucion: ResultadoDeEjecucion): boolean {
  return ejecucion.resultado === 'fallida' || ejecucion.causa === 'sin_respuesta';
}

export interface FilaDeConfirmacion {
  readonly origen: OrigenDeConfirmacion;
  readonly resultado: Ejecucion;
  readonly causa: CausaDeEjecucion;
}

/**
 * La fila que manda sobre un evento: la de la placa si existe (una confirmación tardía se impone a la constancia
 * `sin_respuesta` del servidor, aunque se haya escrito antes), y si no, la del servidor.
 */
export function filaEfectiva<F extends FilaDeConfirmacion>(filas: readonly F[]): F | null {
  return filas.find((fila) => fila.origen === 'placa') ?? filas[0] ?? null;
}
