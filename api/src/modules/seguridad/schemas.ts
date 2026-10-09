import { z } from 'zod';

export const esquemaId = z.string().regex(/^\d{1,19}$/);

const esquemaRol = z.object({ id: z.string(), nombre: z.string() });

export const cuerpoDeIngreso = z.object({ pin: z.string().min(1).max(32) });

export const respuestaDeIngreso = z.object({
  acceso: z.string(),
  refresco: z.string(),
  usuario: z.object({ id: z.string(), etiqueta: z.string().nullable() }),
  cuenta: z.object({ id: z.string(), codigo: z.string(), nombre: z.string() }),
  roles: z.array(esquemaRol),
  rol_activo_id: z.string().nullable(),
});

export const cuerpoDeRefresco = z.object({ refresco: z.string().min(1).max(256) });

export const respuestaDeRefresco = z.object({ acceso: z.string(), refresco: z.string() });

export const cuerpoDeRolActivo = z.object({ rol_id: esquemaId });

export const respuestaDeRolActivo = z.object({ acceso: z.string() });

export const respuestaDeSesionActual = z.object({
  usuario: z.object({ id: z.string(), etiqueta: z.string().nullable() }),
  cuenta: z.object({ id: z.string(), codigo: z.string(), nombre: z.string() }),
  roles: z.array(esquemaRol),
  rol_activo: esquemaRol.nullable(),
  permisos: z.array(z.string()),
});
