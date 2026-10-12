import { z } from 'zod';

const esquemaId = z.string().regex(/^\d{1,19}$/);

export const esquemaPlan = z.object({
  id: z.string(),
  nombre: z.string(),
  cupo_usuarios: z.number().int().nullable(),
  precio_anual: z.number(),
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

export const cuerpoDePrecios = z.object({
  precios: z
    .array(z.object({ plan_id: esquemaId, precio_anual: esquemaPrecio }))
    .min(1)
    .max(20),
});

export const parametrosDeCuenta = z.object({ id: esquemaId });
export const parametrosDeComprobante = z.object({ id: esquemaId });

export const cuerpoDeCambioDePlan = z.object({ plan_id: esquemaId });

export const respuestaDeCambioDePlan = z.object({
  plan: z.object({
    id: z.string(),
    nombre: z.string(),
    cupo_usuarios: z.number().int().nullable(),
  }),
  diferencia_precio: z.number(),
});

/**
 * Dónde llegó el dinero y su comprobante (ADR 0024). Una transferencia o un depósito exigen los tres
 * datos; un pago en efectivo no los lleva. Lo usan también el alta de una cuenta y el registro de un pago.
 */
export const camposDeBancoYComprobante = {
  banco: z.string().trim().min(1).max(60).optional(),
  cuenta_destino: z.string().trim().min(1).max(60).optional(),
  comprobante_id: esquemaId.optional(),
};

/** Falla si un pago no efectivo no trae banco, cuenta de destino y comprobante. */
export function exigirRespaldoDelPago(
  pago: {
    medio: string;
    banco?: string | undefined;
    cuenta_destino?: string | undefined;
    comprobante_id?: string | undefined;
  },
  ctx: z.RefinementCtx,
): void {
  if (pago.medio === 'efectivo') return;
  for (const campo of ['banco', 'cuenta_destino', 'comprobante_id'] as const) {
    if (pago[campo] === undefined) {
      ctx.addIssue({ code: 'custom', path: [campo], message: 'requerido' });
    }
  }
}

export const cuerpoDePago = z
  .object({
    tipo: z.enum(['alta', 'renovacion', 'mejora_de_plan']),
    monto: z
      .number()
      .positive()
      .max(99_999_999)
      .refine((n) => Math.round(n * 100) / 100 === n),
    fecha_pago: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    medio: z.enum(['transferencia', 'deposito', 'efectivo']),
    referencia: z.string().trim().min(1).max(80),
    ...camposDeBancoYComprobante,
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

export const cuerpoDePlanNuevo = z.object({
  nombre: esquemaNombreDePlan,
  cupo_usuarios: esquemaCupo,
  precio_anual: esquemaPrecio,
});

export const cuerpoDeEdicionDePlan = z
  .object({
    nombre: esquemaNombreDePlan.optional(),
    cupo_usuarios: esquemaCupo.optional(),
    precio_anual: esquemaPrecio.optional(),
  })
  .refine((cuerpo) => Object.keys(cuerpo).length > 0);

export const parametrosDePlan = z.object({ id: esquemaId });

export const respuestaDePlanCreado = z.object({ id: z.string() });
export const respuestaDePlanRetirado = z.object({ resultado: z.enum(['retirado', 'eliminado']) });
