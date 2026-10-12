import { celdaCsv } from '../../../shared/lib/csv';

/** Reglas puras de los pagos y la cobranza (A07 y A08), ADR 0022. */

export type MedioDePago = 'transferencia' | 'deposito' | 'efectivo';
export const MEDIOS: readonly MedioDePago[] = ['transferencia', 'deposito', 'efectivo'];

export type TipoDePago = 'renovacion' | 'mejora_de_plan';

export interface FormularioDePago {
  /** Lo que escribió la persona: dígitos con o sin puntos de miles. */
  monto: string;
  /** `aaaa-mm-dd`. */
  fechaPago: string;
  medio: MedioDePago;
  referencia: string;
}

export type ErrorDePago = 'requerido' | 'formato';

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
  return errores;
}

export type VentanaDeCobranza = 'd30' | 'd60' | 'd90' | 'vencidas';
export const VENTANAS: readonly VentanaDeCobranza[] = ['d30', 'd60', 'd90', 'vencidas'];

export type EstadoDePago = 'pendiente' | 'sinPagar';
export type EstadoDeCuenta = 'activa' | 'porVencer' | 'vencida' | 'suspendida';

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
    cobradoAnio: { anio: number; monto: number; pagos: number };
  };
  conteos: Record<VentanaDeCobranza, number>;
  filas: readonly FilaDeCobranza[];
}

/** El CSV de la cobranza visible: una fila por cuenta, fechas `aaaa-mm-dd` para que Excel las ordene. */
export function cobranzaACsv(
  filas: readonly FilaDeCobranza[],
  encabezados: readonly string[],
  textoDePago: (pago: EstadoDePago) => string,
): string {
  const cuerpo = filas.map((f) =>
    [
      f.cuenta.nombre,
      f.cuenta.codigo,
      f.plan.nombre,
      f.monto,
      f.venceEl.toISOString().slice(0, 10),
      textoDePago(f.pago),
    ]
      .map(celdaCsv)
      .join(','),
  );
  return [encabezados.map(celdaCsv).join(','), ...cuerpo].join('\r\n');
}
