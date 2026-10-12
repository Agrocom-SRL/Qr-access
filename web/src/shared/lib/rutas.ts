/**
 * Rutas del panel en un solo lugar: nadie escribe un path a mano. Viven en `shared` porque las
 * usan varios módulos para enlazarse sin importarse entre sí.
 */
export const RUTAS = {
  ingreso: '/ingreso',
  resumen: '/',
  cuentas: '/cuentas',
  cuentaNueva: '/cuentas/nueva',
  cobranza: '/cobranza',
  planes: '/planes',
  bitacora: '/bitacora',
  equipo: '/equipo',
  perfil: '/perfil',
  estados: '/estados',
} as const;

export const rutaDeCuenta = (id: string, pestana?: string): string =>
  pestana === undefined ? `/cuentas/${id}` : `/cuentas/${id}?pestana=${pestana}`;

export interface OpcionesDePago {
  /** `mejora`: cobrar la diferencia de un cambio de plan (no renueva). */
  tipo?: 'mejora';
  monto?: number;
}

/** Pantalla "Registra el pago" de una cuenta (A07); con `tipo=mejora` cobra la diferencia de plan. */
export function rutaDePago(cuentaId: string, opciones: OpcionesDePago = {}): string {
  const parametros = new URLSearchParams();
  if (opciones.tipo) parametros.set('tipo', opciones.tipo);
  if (opciones.monto !== undefined) parametros.set('monto', String(opciones.monto));
  const consulta = parametros.toString();
  return `/cobranza/${cuentaId}/pago${consulta === '' ? '' : `?${consulta}`}`;
}
