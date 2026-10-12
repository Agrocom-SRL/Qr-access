/** Reglas puras de los planes (A09): un plan por cupo de usuarios y un precio anual en bolivianos. */

export interface Plan {
  id: string;
  nombre: string;
  /** Cupo de usuarios activos; `null` = sin tope. */
  cupoUsuarios: number | null;
  precioAnual: number;
  cuentas: number;
  usuariosEnUso: number;
}

/**
 * Lee lo que escribió la persona en el campo de precio: dígitos con o sin puntos de miles
 * (`12.000`). Devuelve `null` si no es un monto entero válido; el panel no maneja centavos.
 */
export function parsearPrecio(texto: string): number | null {
  const limpio = texto.trim().replaceAll('.', '');
  if (!/^\d{1,8}$/.test(limpio)) return null;
  return Number(limpio);
}

/** Precios nuevos por plan que difieren de los vigentes: lo único que se manda a la API. */
export function cambiosDePrecio(
  planes: readonly Plan[],
  borrador: Readonly<Record<string, number>>,
): { planId: string; precioAnual: number }[] {
  return planes
    .filter((plan) => plan.id in borrador && borrador[plan.id] !== plan.precioAnual)
    .map((plan) => ({ planId: plan.id, precioAnual: borrador[plan.id] ?? plan.precioAnual }));
}

export interface FormularioDePlan {
  nombre: string;
  /** Lo escrito: un entero de 1 en adelante. */
  cupo: string;
  /** Lo escrito: dígitos con o sin puntos de miles. */
  precio: string;
}

export type ErrorDePlan = 'requerido' | 'cupoInvalido' | 'precioInvalido';

export function parsearCupo(texto: string): number | null {
  if (!/^\d{1,6}$/.test(texto.trim())) return null;
  const valor = Number(texto.trim());
  return valor >= 1 ? valor : null;
}

/** Validación del formulario de plan antes de llamar a la API (que la repite: la autoridad es el servidor). */
export function validarPlan(
  datos: FormularioDePlan,
): Partial<Record<keyof FormularioDePlan, ErrorDePlan>> {
  const errores: Partial<Record<keyof FormularioDePlan, ErrorDePlan>> = {};
  if (datos.nombre.trim() === '') errores.nombre = 'requerido';
  if (datos.cupo.trim() === '') errores.cupo = 'requerido';
  else if (parsearCupo(datos.cupo) === null) errores.cupo = 'cupoInvalido';
  if (datos.precio.trim() === '') errores.precio = 'requerido';
  else if (parsearPrecio(datos.precio) === null) errores.precio = 'precioInvalido';
  return errores;
}

export type ResultadoDeRetiro = 'retirado' | 'eliminado';
