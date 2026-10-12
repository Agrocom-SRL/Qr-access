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
