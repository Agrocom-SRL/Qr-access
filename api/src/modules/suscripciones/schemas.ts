import { z } from 'zod';

const esquemaId = z.string().regex(/^\d{1,19}$/);

export const esquemaPlan = z.object({
  id: z.string(),
  nombre: z.string(),
  cupo_usuarios: z.number().int().nullable(),
  precio_anual: z.number(),
  /** `null` = el plan no fija la bolsa mensual de QR y rige la general (ADR 0030 §2). */
  bolsa_qr_mensual: z.number().int().nullable(),
  /** `null` = el plan no fija las puertas por QR y rige el general (ADR 0031 §9). */
  max_puertas_por_qr: z.number().int().nullable(),
  cuentas: z.number().int(),
  usuarios_en_uso: z.number().int(),
});

export const respuestaDePlanes = z.object({ datos: z.array(esquemaPlan) });

/** Precio en bolivianos: no negativo, con a lo sumo 2 decimales. */
const esquemaPrecio = z
  .number()
  .min(0)
  .max(99_999_999)
  .refine((n) => Math.round(n * 100) / 100 === n);

export const cuerpoDePrecios = z.strictObject({
  precios: z
    .array(z.strictObject({ plan_id: esquemaId, precio_anual: esquemaPrecio }))
    .min(1)
    .max(20),
});

export const parametrosDeCuenta = z.object({ id: esquemaId });
export const parametrosDeComprobante = z.object({ id: esquemaId });

export const cuerpoDeCambioDePlan = z.strictObject({ plan_id: esquemaId });

export const respuestaDeCambioDePlan = z.object({
  plan: z.object({
    id: z.string(),
    nombre: z.string(),
    cupo_usuarios: z.number().int().nullable(),
  }),
  diferencia_precio: z.number(),
});

/**
 * El comprobante del pago (ADR 0024). Una transferencia o un pago por QR lo exigen; un pago en efectivo no
 * lo lleva. El banco y la cuenta de destino ya no se piden: AGROCOM registra pagos hechos a sí misma.
 * Lo usan también el alta de una cuenta y el registro de un pago.
 */
export const camposDeComprobante = {
  comprobante_id: esquemaId.optional(),
};

/** Falla si un pago no efectivo no trae comprobante. */
export function exigirRespaldoDelPago(
  pago: { medio: string; comprobante_id?: string | undefined },
  ctx: z.RefinementCtx,
): void {
  if (pago.medio === 'efectivo') return;
  if (pago.comprobante_id === undefined) {
    ctx.addIssue({ code: 'custom', path: ['comprobante_id'], message: 'requerido' });
  }
}

export const cuerpoDePago = z
  .strictObject({
    tipo: z.enum(['alta', 'renovacion', 'mejora_de_plan']),
    monto: z
      .number()
      .positive()
      .max(99_999_999)
      .refine((n) => Math.round(n * 100) / 100 === n),
    fecha_pago: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    medio: z.enum(['transferencia', 'qr', 'efectivo']),
    // Es un pago completo, no por cuotas: la referencia es un dato opcional.
    referencia: z.string().trim().max(80).default(''),
    ...camposDeComprobante,
  })
  .superRefine(exigirRespaldoDelPago);

export const respuestaDeComprobante = z.object({
  id: z.string(),
  tipo_mime: z.string(),
  tamano: z.number().int(),
});

export const respuestaDePago = z.object({
  id: z.string(),
  tipo: z.enum(['alta', 'renovacion', 'mejora_de_plan']),
  periodo_desde: z.string(),
  periodo_hasta: z.string(),
  vence_el: z.string(),
});

const esquemaNombreDePlan = z.string().trim().min(1).max(80);
const esquemaCupo = z.number().int().min(1).max(100_000);

export const cuerpoDePlanNuevo = z.strictObject({
  nombre: esquemaNombreDePlan,
  cupo_usuarios: esquemaCupo,
  precio_anual: esquemaPrecio,
});

export const cuerpoDeEdicionDePlan = z
  .strictObject({
    nombre: esquemaNombreDePlan.optional(),
    cupo_usuarios: esquemaCupo.optional(),
    precio_anual: esquemaPrecio.optional(),
    /** `null` devuelve el plan a la bolsa general. */
    bolsa_qr_mensual: z.number().int().min(1).max(100_000_000).nullable().optional(),
    /** `null` devuelve el plan al máximo general de puertas por QR. */
    max_puertas_por_qr: z.number().int().min(1).max(1_000).nullable().optional(),
  })
  .refine((cuerpo) => Object.keys(cuerpo).length > 0);

export const parametrosDePlan = z.object({ id: esquemaId });

export const respuestaDePlanCreado = z.object({ id: z.string() });
export const respuestaDePlanRetirado = z.object({ resultado: z.enum(['retirado', 'eliminado']) });

/** Las cuentas donde AGROCOM recibe pagos (ADR 0029). */
const esquemaBanco = z.string().trim().min(1).max(60);
const esquemaTipoDeCuenta = z.enum(['ahorro', 'corriente']);
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((texto) => (texto === '' ? null : texto));

export const esquemaCuentaDeCobro = z.object({
  id: z.string(),
  metodo: z.enum(['transferencia', 'qr']),
  banco: z.string(),
  titular: z.string().nullable(),
  numero_cuenta: z.string().nullable(),
  tipo_cuenta: esquemaTipoDeCuenta.nullable(),
  imagen_id: z.string().nullable(),
  nota: z.string().nullable(),
  activo: z.boolean(),
});

export const respuestaDeCuentasDeCobro = z.object({ datos: z.array(esquemaCuentaDeCobro) });

export const cuerpoDeCuentaDeCobroNueva = z.strictObject({
  metodo: z.enum(['transferencia', 'qr']),
  banco: esquemaBanco,
  titular: textoOpcional(120).optional(),
  numero_cuenta: textoOpcional(40).optional(),
  // `null` se acepta porque el panel lo envía cuando no hay tipo (ampliación compatible).
  tipo_cuenta: esquemaTipoDeCuenta.nullable().optional(),
  imagen_id: esquemaId.optional(),
  nota: textoOpcional(200).optional(),
});

export const cuerpoDeEdicionDeCuentaDeCobro = z
  .strictObject({
    banco: esquemaBanco.optional(),
    titular: textoOpcional(120).optional(),
    numero_cuenta: textoOpcional(40).optional(),
    tipo_cuenta: esquemaTipoDeCuenta.nullable().optional(),
    imagen_id: esquemaId.nullable().optional(),
    nota: textoOpcional(200).optional(),
    activo: z.boolean().optional(),
  })
  .refine((cuerpo) => Object.keys(cuerpo).length > 0);

export const parametrosDeCuentaDeCobro = z.object({ id: esquemaId });
