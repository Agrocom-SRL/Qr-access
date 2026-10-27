/** Intentos de acceso de las placas (lecturas de QR) vistos por el super admin, de todas las cuentas. */

export type ResultadoDeEvento = 'permitido' | 'rechazado';
export type FiltroDeResultado = ResultadoDeEvento | 'todos';

export const FILTROS_DE_RESULTADO: readonly FiltroDeResultado[] = [
  'todos',
  'permitido',
  'rechazado',
];

/**
 * Qué pasó con la orden de abrir (ADR 0031 §18): la placa informa el desenlace después de
 * accionar el relé. `null` en un rechazo o mientras la placa todavía no informa.
 */
export type EjecucionDeEvento = 'ejecutada' | 'fallida' | 'sin_confirmacion';
export type FiltroDeEjecucion = EjecucionDeEvento | 'todas';

export const FILTROS_DE_EJECUCION: readonly FiltroDeEjecucion[] = [
  'todas',
  'ejecutada',
  'fallida',
  'sin_confirmacion',
];

/** Por qué terminó así la orden de abrir; las claves son las de `eventos:ejecucionCausa`. */
export const CAUSAS_DE_EJECUCION = [
  'puerta_abrio',
  'puerta_no_abrio',
  'puerta_no_cerro',
  'rele_no_accionado',
  'sin_sensor',
  'sin_respuesta',
] as const;
export type CausaDeEjecucion = (typeof CAUSAS_DE_EJECUCION)[number];

/**
 * La causa que llega de la API si el panel la conoce; una causa nueva no se muestra en crudo (se
 * omite) para no inventar un texto.
 */
export function causaDeEjecucion(texto: string | null): CausaDeEjecucion | null {
  return CAUSAS_DE_EJECUCION.find((causa) => causa === texto) ?? null;
}

export interface EventoDeAcceso {
  id: string;
  ocurridoEn: Date;
  resultado: ResultadoDeEvento;
  /** Código del motivo (`acceso.permitido`, `qr.vencido`…): se traduce, no se muestra en crudo. */
  motivoCode: string;
  cuenta: { id: string; codigo: string; nombre: string };
  puerta: { id: string; nombre: string; sitio: string };
  /** Nombre del lector que leyó el QR; `null` si no se registró. */
  dispositivo: string | null;
  qrEtiqueta: string | null;
  ejecucion: EjecucionDeEvento | null;
  ejecucionCausa: CausaDeEjecucion | null;
}

export interface FiltrosDeEventos {
  cuentaId: string | null;
  resultado: FiltroDeResultado;
  ejecucion: FiltroDeEjecucion;
  /** `aaaa-mm-dd` en la zona de la plataforma, o vacío. */
  desde: string;
  hasta: string;
  pagina: number;
}

export interface OpcionDeCuenta {
  id: string;
  codigo: string;
  nombre: string;
}

export const POR_PAGINA_DE_EVENTOS = 15;

/** Cada cuánto se vuelve a pedir la lista: una lectura nueva aparece sin recargar. */
export const REFRESCO_DE_EVENTOS_MS = 5_000;
