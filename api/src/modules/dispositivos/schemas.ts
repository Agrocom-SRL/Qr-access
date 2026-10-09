import { z } from 'zod';

export const cuerpoDeLatido = z.object({
  firmware: z.string().min(1).max(20),
  rssi: z.number().int().min(-200).max(100),
  puerta_abierta: z.boolean(),
});

export const respuestaDeConfiguracion = z.object({
  segundos_apertura: z.number().int(),
  zona_horaria: z.string(),
  ota: z.null(),
});
