/** Intentos de acceso de las placas (lecturas de QR) vistos por el super admin, de todas las cuentas. */

export type ResultadoDeEvento = 'permitido' | 'rechazado';
export type FiltroDeResultado = ResultadoDeEvento | 'todos';

export const FILTROS_DE_RESULTADO: readonly FiltroDeResultado[] = [
  'todos',
  'permitido',
  'rechazado',
];

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
}

export interface FiltrosDeEventos {
  cuentaId: string | null;
  resultado: FiltroDeResultado;
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
