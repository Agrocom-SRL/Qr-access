import { z } from 'zod';
import { esquemaListado } from '../../platform/http/paginacion.js';
import { ESTADOS_DE_QR } from './domain/estado-qr.js';

const esquemaId = z.string().regex(/^\d{1,19}$/);
const esquemaFecha = z.string();
const esquemaPuertaCorta = z.object({ id: z.string(), nombre: z.string() });

export const MAX_PUERTAS_POR_QR = 20;
export const MAX_ETIQUETA = 60;

export const cuerpoDeEmision = z.object({
  puerta_ids: z.array(esquemaId).min(1).max(MAX_PUERTAS_POR_QR),
  vence_at: z.iso
    .datetime({ offset: true })
    .transform((texto) => new Date(texto))
    .optional(),
  etiqueta: z
    .string()
    .trim()
    .max(MAX_ETIQUETA)
    .transform((texto) => (texto === '' ? null : texto))
    .nullish(),
});

export const respuestaDeEmision = z.object({
  id: z.string(),
  texto: z.string(),
  vence_at: esquemaFecha,
  etiqueta: z.string().nullable(),
  puertas: z.array(esquemaPuertaCorta),
});

export const esquemaQr = z.object({
  id: z.string(),
  etiqueta: z.string().nullable(),
  estado: z.enum(ESTADOS_DE_QR as [string, ...string[]]),
  vence_at: esquemaFecha,
  usado_at: esquemaFecha.nullable(),
  anulado_at: esquemaFecha.nullable(),
  created_at: esquemaFecha,
  puertas: z.array(esquemaPuertaCorta),
});

export const consultaDeQr = z.object({
  estado: z.enum(ESTADOS_DE_QR as [string, ...string[]]).optional(),
});
export const parametrosDeQr = z.object({ id: esquemaId });
export const respuestaListadoDeQr = esquemaListado(esquemaQr);

export const esquemaEvento = z.object({
  id: z.string(),
  ocurrido_at: esquemaFecha,
  resultado: z.enum(['permitido', 'rechazado']),
  motivo_code: z.string(),
  puerta: esquemaPuertaCorta,
  qr_id: z.string().nullable(),
});
export const respuestaListadoDeEventos = esquemaListado(esquemaEvento);

export const cuerpoDeValidacion = z.object({
  token: z.string().max(512),
  leido_en: z.string().max(40).optional(),
});

export const respuestaDeValidacion = z.object({
  abrir: z.boolean(),
  segundos: z.number().int().optional(),
  evento_id: z.string(),
  motivo_code: z.string(),
});
