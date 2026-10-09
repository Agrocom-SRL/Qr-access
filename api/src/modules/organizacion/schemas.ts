import { z } from 'zod';
import { esquemaListado } from '../../platform/http/paginacion.js';

export const esquemaPuerta = z.object({
  id: z.string(),
  nombre: z.string(),
  sitio: z.object({ id: z.string(), nombre: z.string() }),
});

export const esquemaListadoDePuertas = esquemaListado(esquemaPuerta);
