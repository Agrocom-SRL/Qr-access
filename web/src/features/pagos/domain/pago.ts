import type { EstadoDeSuscripcion } from '../../../shared/api/estados';
import type { DefinicionDeLibro } from '../../../shared/lib/excel';

/** Reglas puras de los pagos y la cobranza (A07 y A08), ADR 0022. */

export type MedioDePago = 'transferencia' | 'deposito' | 'efectivo';
export const MEDIOS: readonly MedioDePago[] = ['transferencia', 'deposito', 'efectivo'];

export type TipoDePago = 'alta' | 'renovacion' | 'mejora_de_plan';

/** Bancos donde AGROCOM recibe los pagos. TODO(docs): confirmar con negocio las cuentas reales. */
export const BANCOS = [
  'Banco Unión',
  'Banco Nacional de Bolivia',
  'Banco de Crédito',
  'Banco Mercantil Santa Cruz',
  'Banco BISA',
  'Banco Ganadero',
  'Banco Económico',
  'Banco FIE',
  'Banco Sol',
  'Banco Fassil',
  'Banco Prodem',
  'Otro',
] as const;

/** Lo que acepta la API como comprobante (ADR 0024): se revisa también acá para avisar antes de subir. */
export const TIPOS_DE_COMPROBANTE = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const MAX_BYTES_DE_COMPROBANTE = 5 * 1024 * 1024;

export function requiereRespaldo(medio: MedioDePago): boolean {
  return medio !== 'efectivo';
}

export interface FormularioDePago {
  /** Lo que escribió la persona: dígitos con o sin puntos de miles. */
  monto: string;
  /** `aaaa-mm-dd`. */
  fechaPago: string;
  medio: MedioDePago;
  referencia: string;
  /** A qué banco y cuenta de AGROCOM llegó el dinero; solo para transferencia y depósito. */
  banco: string;
  cuentaDestino: string;
  /** La foto o el PDF del comprobante; solo para transferencia y depósito. */
  comprobante: File | null;
}

export type ErrorDePago = 'requerido' | 'formato' | 'archivoInvalido' | 'archivoGrande';

/** `12.000` o `12000` → 12000; `null` si no es un monto entero mayor que cero. */
export function parsearMonto(texto: string): number | null {
  const limpio = texto.trim().replaceAll('.', '');
  if (!/^\d{1,8}$/.test(limpio)) return null;
  const valor = Number(limpio);
  return valor > 0 ? valor : null;
}

export function validarPago(
  datos: FormularioDePago,
): Partial<Record<keyof FormularioDePago, ErrorDePago>> {
  const errores: Partial<Record<keyof FormularioDePago, ErrorDePago>> = {};
  if (datos.monto.trim() === '') errores.monto = 'requerido';
  else if (parsearMonto(datos.monto) === null) errores.monto = 'formato';
  if (datos.fechaPago === '') errores.fechaPago = 'requerido';
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.fechaPago)) errores.fechaPago = 'formato';
  if (datos.referencia.trim() === '') errores.referencia = 'requerido';
  if (requiereRespaldo(datos.medio)) {
    if (datos.banco.trim() === '') errores.banco = 'requerido';
    if (datos.cuentaDestino.trim() === '') errores.cuentaDestino = 'requerido';
    if (datos.comprobante === null) errores.comprobante = 'requerido';
    else if (!TIPOS_DE_COMPROBANTE.includes(datos.comprobante.type)) {
      errores.comprobante = 'archivoInvalido';
    } else if (datos.comprobante.size > MAX_BYTES_DE_COMPROBANTE) {
      errores.comprobante = 'archivoGrande';
    }
  }
  return errores;
}

export type VentanaDeCobranza = 'd30' | 'd60' | 'd90' | 'vencidas' | 'pendientes';
export const VENTANAS: readonly VentanaDeCobranza[] = [
  'd30',
  'd60',
  'd90',
  'vencidas',
  'pendientes',
];

export type EstadoDePago = 'pendiente' | 'sinPagar' | 'porActivar';
export type EstadoDeCuenta = EstadoDeSuscripcion;

export interface FilaDeCobranza {
  cuenta: { id: string; codigo: string; nombre: string };
  plan: { id: string; nombre: string; cupoUsuarios: number | null };
  monto: number;
  venceEl: Date;
  /** Negativo si ya venció. */
  diasRestantes: number;
  pago: EstadoDePago;
  estado: EstadoDeCuenta;
}

export interface Total {
  monto: number;
  cuentas: number;
}

export interface Cobranza {
  totales: {
    porCobrar30: Total;
    porCobrar90: Total;
    vencidoSinPagar: Total;
    /** Cuentas nuevas que todavía no pagaron su alta. */
    porActivar: Total;
    cobradoAnio: { anio: number; monto: number; pagos: number };
  };
  conteos: Record<VentanaDeCobranza, number>;
  filas: readonly FilaDeCobranza[];
}

/**
 * La cobranza visible como tabla de Excel: una fila por cuenta, con el monto como número y el
 * vencimiento como fecha de verdad (para que Excel pueda sumar, ordenar y filtrar).
 */
export function cobranzaAExcel(
  filas: readonly FilaDeCobranza[],
  encabezados: readonly string[],
  hoja: string,
  textoDePago: (pago: EstadoDePago) => string,
): DefinicionDeLibro {
  const [cuenta, codigo, plan, monto, vence, pago] = encabezados;
  return {
    hoja,
    columnas: [
      { encabezado: cuenta ?? '' },
      { encabezado: codigo ?? '', alineacion: 'center' },
      { encabezado: plan ?? '' },
      { encabezado: monto ?? '', formato: '#,##0.00', alineacion: 'right' },
      { encabezado: vence ?? '', formato: 'dd/mm/yyyy', alineacion: 'center' },
      { encabezado: pago ?? '', alineacion: 'center' },
    ],
    filas: filas.map((f) => [
      f.cuenta.nombre,
      f.cuenta.codigo,
      f.plan.nombre,
      f.monto,
      f.venceEl,
      textoDePago(f.pago),
    ]),
  };
}
