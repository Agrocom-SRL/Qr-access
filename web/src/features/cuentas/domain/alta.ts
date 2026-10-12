/** Reglas del alta de cuenta (A04): datos por paso, validaciones y vigencia. Espejo de lo que valida la API. */

export interface DatosDeEmpresa {
  razonSocial: string;
  nit: string;
  ciudad: string;
  codigo: string;
  contactoNombre: string;
  contactoTelefono: string;
}

export interface DatosDeVigencia {
  /** `aaaa-mm-dd`. */
  inicio: string;
  administradorNombre: string;
}

export interface BorradorDeCuenta {
  empresa: DatosDeEmpresa;
  planId: string | null;
  vigencia: DatosDeVigencia;
}

export type ErrorDeCampo = 'requerido' | 'formato';

const NIT = /^[0-9A-Za-z.-]{4,20}$/;
const TELEFONO = /^[0-9+() -]{6,30}$/;
const CODIGO = /^[A-Z]{3}$/;

/** `agr` → `AGR`; solo letras A–Z y a lo sumo 3. Lo que se guarda y se valida contra la API. */
export function normalizarCodigo(entrada: string): string {
  return entrada
    .toUpperCase()
    .replaceAll(/[^A-Z]/g, '')
    .slice(0, 3);
}

export function validarEmpresa(
  datos: DatosDeEmpresa,
): Partial<Record<keyof DatosDeEmpresa, ErrorDeCampo>> {
  const errores: Partial<Record<keyof DatosDeEmpresa, ErrorDeCampo>> = {};
  if (datos.razonSocial.trim() === '') errores.razonSocial = 'requerido';
  if (datos.nit.trim() === '') errores.nit = 'requerido';
  else if (!NIT.test(datos.nit.trim())) errores.nit = 'formato';
  if (datos.ciudad === '') errores.ciudad = 'requerido';
  if (datos.codigo === '') errores.codigo = 'requerido';
  else if (!CODIGO.test(datos.codigo)) errores.codigo = 'formato';
  if (datos.contactoNombre.trim() === '') errores.contactoNombre = 'requerido';
  if (datos.contactoTelefono.trim() === '') errores.contactoTelefono = 'requerido';
  else if (!TELEFONO.test(datos.contactoTelefono.trim())) errores.contactoTelefono = 'formato';
  return errores;
}

export function validarVigencia(
  datos: DatosDeVigencia,
): Partial<Record<keyof DatosDeVigencia, ErrorDeCampo>> {
  const errores: Partial<Record<keyof DatosDeVigencia, ErrorDeCampo>> = {};
  if (datos.inicio === '') errores.inicio = 'requerido';
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.inicio) || Number.isNaN(Date.parse(datos.inicio))) {
    errores.inicio = 'formato';
  }
  if (datos.administradorNombre.trim() === '') errores.administradorNombre = 'requerido';
  return errores;
}

/** Vence = inicio + 12 meses (README, "Vigencia"); `aaaa-mm-dd` → `aaaa-mm-dd`, sin pasarse de fin de mes. */
export function venceUnAnioDespues(inicio: string): string {
  const [anio = 0, mes = 1, dia = 1] = inicio.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(anio + 1, mes, 0)).getUTCDate();
  const vence = new Date(Date.UTC(anio + 1, mes - 1, Math.min(dia, ultimoDia)));
  return vence.toISOString().slice(0, 10);
}

/** La fecha de hoy como `aaaa-mm-dd` en la zona dada (por defecto La Paz). */
export function hoyIso(ahora: Date = new Date(), zona = 'America/La_Paz'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona, dateStyle: 'short' }).format(ahora);
}

/** Ciudades del selector de A04a. TODO(docs): confirmar con negocio la lista definitiva. */
export const CIUDADES = [
  'Santa Cruz de la Sierra',
  'Montero',
  'Warnes',
  'Ascensión de Guarayos',
  'Cochabamba',
  'La Paz',
  'El Alto',
  'Sucre',
  'Tarija',
  'Trinidad',
] as const;

export const BORRADOR_VACIO = (hoy: string): BorradorDeCuenta => ({
  empresa: {
    razonSocial: '',
    nit: '',
    ciudad: '',
    codigo: '',
    contactoNombre: '',
    contactoTelefono: '',
  },
  planId: null,
  vigencia: { inicio: hoy, administradorNombre: '' },
});
