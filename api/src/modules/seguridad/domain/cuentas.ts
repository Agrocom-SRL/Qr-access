import type { EstadoDeSuscripcion } from '../../suscripciones/contracts.js';

/** Reglas puras de la administración de cuentas por AGROCOM (A03 y A04). */

const FORMATO_DE_CODIGO = /^[A-Z]{3}$/;

/** El código de cuenta: 3 letras A–Z, siempre en mayúsculas (ADR 0018); `null` si no tiene esa forma. */
export function normalizarCodigoDeCuenta(entrada: string): string | null {
  const codigo = entrada.trim().toUpperCase();
  return FORMATO_DE_CODIGO.test(codigo) ? codigo : null;
}

/** Palabras que no ayudan a armar un código (tipo de sociedad y conectores). */
const PALABRAS_VACIAS = new Set([
  'S',
  'A',
  'SA',
  'SRL',
  'LTDA',
  'DE',
  'DEL',
  'LA',
  'LAS',
  'LOS',
  'Y',
  'E',
]);

function palabrasDe(razonSocial: string): string[] {
  return razonSocial
    .normalize('NFD')
    .replaceAll(/\p{M}/gu, '')
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter((palabra) => palabra !== '' && !PALABRAS_VACIAS.has(palabra));
}

/**
 * Hasta `maximo` códigos libres parecidos a la razón social: primeras letras de cada palabra,
 * iniciales combinadas y variantes. Siempre en el mismo orden para la misma entrada.
 */
export function sugerirCodigos(
  razonSocial: string,
  ocupados: ReadonlySet<string>,
  maximo = 3,
): string[] {
  const palabras = palabrasDe(razonSocial);
  const candidatos: string[] = [];
  for (const palabra of palabras) candidatos.push(palabra.slice(0, 3));
  const [primera = '', segunda = '', tercera = ''] = palabras;
  candidatos.push(
    primera.slice(0, 1) + segunda.slice(0, 2),
    primera.slice(0, 2) + segunda.slice(0, 1),
    primera.slice(0, 1) + segunda.slice(0, 1) + tercera.slice(0, 1),
    primera.slice(0, 1) + segunda.slice(0, 1) + segunda.slice(-1),
    primera.slice(0, 1) + primera.slice(-2),
    primera.slice(0, 2) + primera.slice(-1),
    primera.slice(0, 1) + segunda.slice(0, 1) + primera.slice(1, 2),
  );
  const unicos: string[] = [];
  for (const candidato of candidatos) {
    if (
      FORMATO_DE_CODIGO.test(candidato) &&
      !ocupados.has(candidato) &&
      !unicos.includes(candidato)
    ) {
      unicos.push(candidato);
    }
  }
  return unicos.slice(0, maximo);
}

export interface CuentaDeLista {
  readonly nombre: string;
  readonly codigo: string;
  readonly estado: EstadoDeSuscripcion;
}

export type FiltroDeEstado = EstadoDeSuscripcion | 'todas';

/** Búsqueda por nombre o código (sin mayúsculas ni tildes) y filtro por estado de la suscripción. */
export function filtrarCuentas<T extends CuentaDeLista>(
  cuentas: readonly T[],
  { busqueda, estado }: { busqueda: string; estado: FiltroDeEstado },
): T[] {
  const buscado = normalizarParaBuscar(busqueda);
  return cuentas.filter(
    (cuenta) =>
      (estado === 'todas' || cuenta.estado === estado) &&
      (buscado === '' ||
        normalizarParaBuscar(cuenta.nombre).includes(buscado) ||
        normalizarParaBuscar(cuenta.codigo).includes(buscado)),
  );
}

function normalizarParaBuscar(texto: string): string {
  return texto.normalize('NFD').replaceAll(/\p{M}/gu, '').toLowerCase().trim();
}

export type ConteoPorEstado = Record<FiltroDeEstado, number>;

/** Cuántas cuentas hay en cada estado (los números del filtro segmentado de A03). */
export function contarPorEstado(
  cuentas: readonly { estado: EstadoDeSuscripcion }[],
): ConteoPorEstado {
  const conteo: ConteoPorEstado = {
    todas: cuentas.length,
    activa: 0,
    por_vencer: 0,
    vencida: 0,
    suspendida: 0,
  };
  for (const cuenta of cuentas) conteo[cuenta.estado] += 1;
  return conteo;
}
