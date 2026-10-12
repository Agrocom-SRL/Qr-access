/** Error de la API (RFC 9457, ADR 0005): `code` estable que el panel traduce; nunca se muestra `detail`. */
export class ErrorApi extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly extra: Readonly<Record<string, unknown>> = {},
  ) {
    super(code);
    this.name = 'ErrorApi';
  }
}

/** Código del error que produce el propio cliente cuando no hay red. */
export const CODIGO_SIN_CONEXION = 'red.sin_conexion';

export function esErrorApi(error: unknown): error is ErrorApi {
  return error instanceof ErrorApi;
}

/** `code` de cualquier error capturado, o `undefined` si no vino de la API. */
export function codigoDe(error: unknown): string | undefined {
  return esErrorApi(error) ? error.code : undefined;
}
