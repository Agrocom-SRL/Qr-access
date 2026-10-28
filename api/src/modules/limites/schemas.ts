import { z } from 'zod';

const esquemaId = z.string().regex(/^\d{1,19}$/);
/** Las claves tienen la forma `qr.tope_diario`; el catálogo decide cuáles existen. */
const esquemaClave = z.string().regex(/^[a-z][a-z0-9_.]{0,59}$/);
const esquemaValor = z.number().int().min(0).max(1_000_000_000);

export const esquemaLimite = z.object({
  clave: z.string(),
  valor: z.number().int().nullable(),
  minimo: z.number().int(),
  maximo: z.number().int(),
  excepcion: z.enum(['usuario', 'cuenta', 'global']),
});

export const respuestaDeLimites = z.object({ datos: z.array(esquemaLimite) });

export const parametrosDeLimite = z.object({ clave: esquemaClave });
export const cuerpoDeLimite = z.strictObject({ valor: esquemaValor });

export const parametrosDeCuentaDeLimites = z.object({ cuenta_id: esquemaId });
export const parametrosDeExcepcion = z.object({ cuenta_id: esquemaId, id: esquemaId });

export const cuerpoDeExcepcion = z.strictObject({
  clave: esquemaClave,
  usuario_id: esquemaId.nullish(),
  valor: esquemaValor,
});

export const esquemaExcepcion = z.object({
  id: z.string(),
  clave: z.string(),
  usuario_id: z.string().nullable(),
  valor: z.number().int(),
  creada_at: z.string(),
});

export const respuestaDeExcepciones = z.object({ datos: z.array(esquemaExcepcion) });
export const respuestaDeExcepcionFijada = z.object({ id: z.string() });
