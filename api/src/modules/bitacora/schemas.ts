import { z } from 'zod';
import { esquemaListado, esquemaPaginacion } from '../../platform/http/paginacion.js';

const esquemaId = z.string().regex(/^\d{1,19}$/);
const esquemaFecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const esquemaValores = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);

export const consultaDeBitacora = esquemaPaginacion.extend({
  cuenta_id: esquemaId.optional(),
  accion: z.enum(['creado', 'actualizado', 'eliminado', 'restaurado']).optional(),
  desde: esquemaFecha.optional(),
  hasta: esquemaFecha.optional(),
});

export const esquemaEventoDeBitacora = z.object({
  id: z.string(),
  ocurrido_at: z.string(),
  usuario: z.object({ id: z.string(), nombre: z.string() }).nullable(),
  cuenta: z.object({ id: z.string(), codigo: z.string() }).nullable(),
  accion: z.enum(['creado', 'actualizado', 'eliminado', 'restaurado']),
  codigo: z.string(),
  origen: z.enum(['api', 'dispositivo', 'sistema']),
  canal: z.enum(['panel', 'app', 'automatico', 'dispositivo']),
  antes: esquemaValores.nullable(),
  despues: esquemaValores.nullable(),
});

export const respuestaDeBitacora = esquemaListado(esquemaEventoDeBitacora);
