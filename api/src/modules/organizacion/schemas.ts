import { z } from 'zod';
import { esquemaListado } from '../../platform/http/paginacion.js';

/** Lector en servicio de la puerta; `null` cuando la puerta todavía no tiene uno (HU-08). */
export const esquemaDispositivoDePuerta = z.object({
  id: z.string(),
  nombre: z.string(),
  /** Reportó un latido hace menos de `LATIDO_MAXIMO_SEGUNDOS` (HU-09). */
  en_linea: z.boolean(),
  ultimo_latido_at: z.string().nullable(),
});

export const esquemaPuerta = z.object({
  id: z.string(),
  nombre: z.string(),
  sitio: z.object({ id: z.string(), nombre: z.string() }),
  dispositivo: esquemaDispositivoDePuerta.nullable(),
});

export const esquemaListadoDePuertas = esquemaListado(esquemaPuerta);
