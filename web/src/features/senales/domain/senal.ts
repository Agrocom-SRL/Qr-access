/**
 * Señales de abuso: incidentes que abre el sistema cuando algo se sale de lo normal (ADR 0030 §4 y
 * ADR 0033 §4). Lo que muestra el panel es para que una persona revise; ninguna señal corta el
 * acceso ni limita la generación de QR.
 */

export const TIPOS_DE_SENAL = [
  'uso_masivo',
  'uso_imposible',
  'pin_compartido',
  'qr_reenviado',
  'generacion_ruidosa',
  'perdida_o_robo',
  'otro',
] as const;
export type TipoDeSenal = (typeof TIPOS_DE_SENAL)[number];

export const GRAVEDADES = ['baja', 'media', 'alta'] as const;
export type Gravedad = (typeof GRAVEDADES)[number];

export const ESTADOS_DE_SENAL = ['sin_resolver', 'pendiente', 'confirmado', 'descartado'] as const;
export type EstadoDeSenal = (typeof ESTADOS_DE_SENAL)[number];

/** `abiertas` junta las que nadie resolvió o quedaron pendientes; `todas` no filtra por estado. */
export type FiltroDeEstadoSenal = 'todas' | 'abiertas' | EstadoDeSenal;

export const POR_PAGINA_DE_SENALES = 20;

/** Periodos del resumen por tipo, en días (la API acepta de 1 a 90). */
export const PERIODOS_DEL_RESUMEN = [7, 30, 90] as const;

export interface CuentaDeSenal {
  id: string;
  codigo: string;
  nombre: string;
}

export interface SenalDeAbuso {
  id: string;
  cuenta: CuentaDeSenal;
  usuario: { id: string; etiqueta: string | null };
  tipo: TipoDeSenal;
  gravedad: Gravedad;
  /** Código con lo medido (`aperturas=13;umbral=12`), nunca una frase: la UI lo traduce. */
  descripcion: string | null;
  estado: EstadoDeSenal;
  ocurridaEn: Date;
}

export interface FiltrosDeSenales {
  cuentaId: string | null;
  /** Id numérico de un usuario; `''` = cualquiera. */
  usuarioId: string;
  tipo: TipoDeSenal | 'todos';
  gravedad: Gravedad | 'todas';
  estado: FiltroDeEstadoSenal;
  /** `aaaa-mm-dd` en la zona de la plataforma, o vacío. */
  desde: string;
  hasta: string;
  pagina: number;
}

export const FILTROS_INICIALES_DE_SENALES: FiltrosDeSenales = {
  cuentaId: null,
  usuarioId: '',
  tipo: 'todos',
  gravedad: 'todas',
  estado: 'abiertas',
  desde: '',
  hasta: '',
  pagina: 1,
};

export interface ResumenPorTipo {
  tipo: TipoDeSenal;
  total: number;
  abiertas: number;
  altas: number;
}

export interface ResumenPorCuenta {
  cuenta: CuentaDeSenal;
  total: number;
  abiertas: number;
  altas: number;
}

export interface ResumenDeSenales {
  dias: number;
  total: number;
  abiertas: number;
  porTipo: readonly ResumenPorTipo[];
  /** Las diez cuentas con más señales, primero las de más gravedad alta. */
  cuentas: readonly ResumenPorCuenta[];
}

/** Lo medido en `descripcion` como pares numéricos. Lo que no es un número se descarta. */
export function medidasDe(descripcion: string | null): Readonly<Record<string, number>> {
  const medidas: Record<string, number> = {};
  for (const par of (descripcion ?? '').split(';')) {
    const [clave, valor] = par.split('=');
    if (clave === undefined || valor === undefined || valor.trim() === '') continue;
    const numero = Number(valor);
    if (Number.isFinite(numero)) medidas[clave.trim()] = numero;
  }
  return medidas;
}

/** Clave del texto que describe la señal, con sus valores ya numéricos. */
export interface DetalleDeSenal {
  clave: string;
  valores: Readonly<Record<string, number>>;
}

/** Todos los campos que pide la plantilla, o `null` si falta alguno (la UI dice «Sin detalle»). */
function conCampos(
  medidas: Readonly<Record<string, number>>,
  campos: readonly string[],
): Record<string, number> | null {
  const valores: Record<string, number> = {};
  for (const campo of campos) {
    const valor = medidas[campo];
    if (valor === undefined) return null;
    valores[campo] = valor;
  }
  return valores;
}

/**
 * Traduce el código de `descripcion` a una plantilla de texto. Un tipo sin plantilla o un código
 * incompleto no se muestra en crudo: se devuelve `null` y el panel dice que no hay detalle.
 */
export function detalleDeSenal(
  tipo: TipoDeSenal,
  descripcion: string | null,
): DetalleDeSenal | null {
  const medidas = medidasDe(descripcion);
  switch (tipo) {
    case 'uso_masivo': {
      const valores = conCampos(medidas, ['aperturas', 'umbral']);
      return valores === null ? null : { clave: 'uso_masivo', valores };
    }
    case 'uso_imposible': {
      const valores = conCampos(medidas, ['pares', 'sitios_min', 'puertas_s']);
      if (valores === null) return null;
      // Con `puertas_s` en 0 el detector no juzga las puertas (ADR 0030 §4): el texto no las menciona.
      if (valores['puertas_s'] === 0) {
        return {
          clave: 'uso_imposible',
          valores: { pares: valores['pares'] ?? 0, sitios: valores['sitios_min'] ?? 0 },
        };
      }
      return {
        clave: 'uso_imposible_con_puertas',
        valores: {
          pares: valores['pares'] ?? 0,
          sitios: valores['sitios_min'] ?? 0,
          puertas: valores['puertas_s'] ?? 0,
        },
      };
    }
    case 'pin_compartido': {
      const valores = conCampos(medidas, ['ips', 'sesiones', 'umbral']);
      return valores === null ? null : { clave: 'pin_compartido', valores };
    }
    case 'qr_reenviado': {
      const valores = conCampos(medidas, ['qrs', 'rechazos', 'lectores', 'minimo']);
      return valores === null ? null : { clave: 'qr_reenviado', valores };
    }
    default:
      return null;
  }
}
