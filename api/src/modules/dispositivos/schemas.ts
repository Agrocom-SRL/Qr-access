import { z } from 'zod';
import { esquemaListado, esquemaPaginacion } from '../../platform/http/paginacion.js';

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

/** El reclamo de una placa sin vínculo (ADR 0025 §5). La clave la sortea la placa. */
export const cuerpoDeReclamo = z.object({
  mac: z.string().min(11).max(17),
  codigo: z.string().min(8).max(32),
  clave: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
  firmware: z.string().min(1).max(20),
});

export const respuestaDeReclamo = z.discriminatedUnion('estado', [
  z.object({ estado: z.literal('pendiente') }),
  z.object({ estado: z.literal('vinculado'), dispositivo_id: z.string() }),
]);

export const parametrosDePlaca = z.object({ id: z.string().regex(/^\d+$/) });

export const cuerpoDeNuevaPlaca = z.object({ mac: z.string().min(11).max(17) });

export const respuestaDePlacaCreada = z.object({
  id: z.string(),
  mac: z.string(),
  /** Se muestra una sola vez: hay que cargarlo en la placa. */
  codigo: z.string(),
});

export const cuerpoDeVinculo = z.object({
  cuenta_id: z.string().regex(/^\d+$/),
  puerta_id: z.string().regex(/^\d+$/),
  nombre: z.string().trim().min(1).max(100),
});

export const respuestaDeVinculo = z.object({ dispositivo_id: z.string() });

export const consultaDePlacas = esquemaPaginacion.extend({
  busqueda: z.string().trim().min(1).max(60).optional(),
  estado: z.enum(['de_fabrica', 'vinculada']).optional(),
});

export const respuestaDePlacas = esquemaListado(
  z.object({
    id: z.string(),
    mac: z.string(),
    estado: z.enum(['de_fabrica', 'vinculada']),
    firmware: z.string().nullable(),
    ip: z.string().nullable(),
    ultimo_contacto_at: z.string().nullable(),
    en_linea: z.boolean(),
    reclamo_hecho: z.boolean(),
    dispositivo: z.object({ id: z.string(), nombre: z.string() }).nullable(),
    cuenta: z.object({ id: z.string(), codigo: z.string(), nombre: z.string() }).nullable(),
    puerta: z.object({ id: z.string(), nombre: z.string() }).nullable(),
  }),
);
