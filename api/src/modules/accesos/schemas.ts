import { z } from 'zod';
import { esquemaListado } from '../../platform/http/paginacion.js';
import { ESTADOS_DE_QR } from './domain/estado-qr.js';
import {
  FORMATO_DE_CLAVE,
  LARGO_MAXIMO_DE_CLAVE,
  LARGO_MINIMO_DE_CLAVE,
} from './domain/idempotencia.js';

const esquemaId = z.string().regex(/^\d{1,19}$/);
const esquemaFecha = z.string();
const esquemaPuertaCorta = z.object({ id: z.string(), nombre: z.string() });

/**
 * Techo de la lista que acepta el esquema (no deja pasar una lista descomunal). El máximo REAL de puertas por
 * QR no es este: sale de la configuración de la plataforma y del plan (`qr.limite_puertas`, ADR 0031 §9).
 */
export const MAX_PUERTAS_POR_QR = 1000;
export const MAX_ETIQUETA = 60;

export const cuerpoDeGeneracion = z.strictObject({
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
  /** QR de "Mi QR de acceso": anula el propio anterior y no aparece en "Mis QR". */
  propio: z.boolean().optional(),
  /**
   * Con `propio`: pide otro QR aunque el vigente siga sin usarse y sea para las mismas puertas (la app perdió su
   * token). El anterior se anula y cuenta como reemplazo sin uso (ADR 0030 §2.1).
   */
  reemplazar: z.boolean().optional(),
});

/** `Idempotency-Key` (opcional, ADR 0031 §11): un identificador al azar por solicitud (UUID v4 o base64url de 22 a 128 caracteres). */
export const cabecerasDeGeneracion = z.object({
  'idempotency-key': z
    .string()
    .min(LARGO_MINIMO_DE_CLAVE)
    .max(LARGO_MAXIMO_DE_CLAVE)
    .regex(FORMATO_DE_CLAVE)
    .optional(),
});

export const respuestaDeGeneracion = z.object({
  id: z.string(),
  /** `null` si `reutilizado`: el servidor no guarda el token y la app lo muestra desde su copia local. */
  texto: z.string().nullable(),
  /** `true` = no se generó nada: ya había un QR propio vigente y sin usar para esas puertas (200, no 201). */
  reutilizado: z.boolean(),
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
export const respuestaDeEstadoDeQr = z.object({
  id: z.string(),
  estado: z.enum(ESTADOS_DE_QR as [string, ...string[]]),
  vence_at: esquemaFecha,
  ultimo_intento: z
    .object({
      ocurrido_at: esquemaFecha,
      resultado: z.enum(['permitido', 'rechazado']),
      motivo_code: z.string(),
      puerta: esquemaPuertaCorta,
    })
    .nullable(),
});
export const respuestaListadoDeQr = esquemaListado(esquemaQr);

export const respuestaDeResumenDeQr = z.object({
  vigentes: z.number().int(),
  usados: z.number().int(),
  vencidos: z.number().int(),
  anulados: z.number().int(),
});

const esquemaFechaDeFiltro = z.iso.datetime({ offset: true }).transform((texto) => new Date(texto));

/** Filtros del listado y del resumen de eventos: resultado, puerta y ventana `[desde, hasta)`. */
export const consultaDeEventos = z.object({
  resultado: z.enum(['permitido', 'rechazado']).optional(),
  puerta_id: esquemaId.optional(),
  desde: esquemaFechaDeFiltro.optional(),
  hasta: esquemaFechaDeFiltro.optional(),
});

export const esquemaEvento = z.object({
  id: z.string(),
  ocurrido_at: esquemaFecha,
  resultado: z.enum(['permitido', 'rechazado']),
  motivo_code: z.string(),
  puerta: esquemaPuertaCorta.extend({ sitio: z.object({ id: z.string(), nombre: z.string() }) }),
  qr_id: z.string().nullable(),
  qr: z
    .object({
      id: z.string(),
      etiqueta: z.string().nullable(),
      generador: z.object({ id: z.string(), etiqueta: z.string().nullable() }),
    })
    .nullable(),
});
export const respuestaListadoDeEventos = esquemaListado(esquemaEvento);

export const respuestaDeResumenDeEventos = z.object({
  permitidos: z.number().int(),
  rechazados: z.number().int(),
  rechazados_por_motivo: z.array(z.object({ motivo_code: z.string(), total: z.number().int() })),
});

export const cuerpoDeValidacion = z.strictObject({
  token: z.string().max(512),
  leido_en: z.string().max(40).optional(),
});

export const respuestaDeValidacion = z.object({
  abrir: z.boolean(),
  segundos: z.number().int().optional(),
  evento_id: z.string(),
  motivo_code: z.string(),
});
