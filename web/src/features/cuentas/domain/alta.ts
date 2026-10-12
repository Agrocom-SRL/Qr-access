import { validarPago, type FormularioDePago } from '../../pagos';

/** Reglas del alta de cuenta (A04): datos por paso, validaciones y vigencia. Espejo de lo que valida la API. */

export interface DatosDeEmpresa {
  razonSocial: string;
  nit: string;
  ciudad: string;
  codigo: string;
  /** La persona responsable de la cuenta: con quien AGROCOM trata el servicio y los pagos. */
  contactoNombre: string;
  contactoTelefono: string;
  contactoCorreo: string;
}

export interface DatosDeVigencia {
  /** `aaaa-mm-dd`. */
  inicio: string;
  administradorNombre: string;
  /** El administrador es la misma persona responsable: se usa su nombre. */
  adminIgualAlResponsable: boolean;
}

/**
 * Cómo se cobra el alta: con el pago ya registrado (la cuenta nace activa) o después (la cuenta
 * nace pendiente de pago y aparece en Cobranza hasta que se registre).
 */
export interface DatosDePagoDeAlta extends FormularioDePago {
  modo: 'ahora' | 'despues';
}

export interface BorradorDeCuenta {
  empresa: DatosDeEmpresa;
  planId: string | null;
  vigencia: DatosDeVigencia;
  pago: DatosDePagoDeAlta;
}

export type ErrorDeCampo = 'requerido' | 'formato';

const NIT = /^[0-9A-Za-z.-]{4,20}$/;
const TELEFONO = /^[0-9+() -]{6,30}$/;
const CODIGO = /^[A-Z]{3}$/;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  if (datos.contactoCorreo.trim() === '') errores.contactoCorreo = 'requerido';
  else if (!CORREO.test(datos.contactoCorreo.trim())) errores.contactoCorreo = 'formato';
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
  if (!datos.adminIgualAlResponsable && datos.administradorNombre.trim() === '') {
    errores.administradorNombre = 'requerido';
  }
  return errores;
}

/** El pago de alta solo se valida si se registra ahora; si se cobra después, no hay nada que revisar. */
export function validarPagoDeAlta(datos: DatosDePagoDeAlta): ReturnType<typeof validarPago> {
  return datos.modo === 'despues' ? {} : validarPago(datos);
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

/**
 * Ciudades del selector (A04a): las capitales de departamento, El Alto y las poblaciones donde
 * AGROCOM tiene clientes. TODO(docs): confirmar con negocio la lista definitiva.
 */
export const CIUDADES = [
  'Santa Cruz de la Sierra',
  'La Paz',
  'Cochabamba',
  'El Alto',
  'Sucre',
  'Oruro',
  'Potosí',
  'Tarija',
  'Trinidad',
  'Cobija',
  'Montero',
  'Warnes',
  'Ascensión de Guarayos',
  'San Ignacio de Velasco',
  'Yacuiba',
  'Camiri',
] as const;

export const BORRADOR_VACIO = (hoy: string): BorradorDeCuenta => ({
  empresa: {
    razonSocial: '',
    nit: '',
    ciudad: '',
    codigo: '',
    contactoNombre: '',
    contactoTelefono: '',
    contactoCorreo: '',
  },
  planId: null,
  vigencia: { inicio: hoy, administradorNombre: '', adminIgualAlResponsable: false },
  pago: {
    modo: 'despues',
    monto: '',
    fechaPago: hoy,
    medio: 'transferencia',
    referencia: '',
    banco: '',
    cuentaDestino: '',
    comprobante: null,
  },
});
