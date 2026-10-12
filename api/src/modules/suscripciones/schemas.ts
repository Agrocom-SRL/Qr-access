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

export const cuerpoDeCambioDePlan = z.object({ plan_id: esquemaId });

export const respuestaDeCambioDePlan = z.object({
  plan: z.object({
    id: z.string(),
    nombre: z.string(),
    cupo_usuarios: z.number().int().nullable(),
  }),
  diferencia_precio: z.number(),
});

export const cuerpoDePago = z.object({
  tipo: z.enum(['renovacion', 'mejora_de_plan']),
  monto: z
    .number()
    .positive()
    .max(99_999_999)
    .refine((n) => Math.round(n * 100) / 100 === n),
  fecha_pago: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  medio: z.enum(['transferencia', 'deposito', 'efectivo']),
  referencia: z.string().trim().min(1).max(80),
});

export const respuestaDePago = z.object({
  id: z.string(),
  tipo: z.enum(['renovacion', 'mejora_de_plan']),
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
