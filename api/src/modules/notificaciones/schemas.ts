import { z } from 'zod';
import { esquemaListado, esquemaPaginacion } from '../../platform/http/paginacion.js';
import { TIPOS_DE_NOTIFICACION } from './domain/aviso.js';

const esquemaId = z.string().regex(/^\d{1,19}$/);
const esquemaTipo = z.enum(TIPOS_DE_NOTIFICACION as [string, ...string[]]);

export const consultaDeNotificaciones = esquemaPaginacion.extend({
  /** `no_leidas` = solo las que aún no abrió; por omisión, todas las que no descartó. */
  estado: z.enum(['todas', 'no_leidas']).default('todas'),
  tipo: esquemaTipo.optional(),
});

/** La bandeja de AGROCOM junta varias cuentas: se puede acotar a una. */
export const consultaDeNotificacionesDePlataforma = consultaDeNotificaciones.extend({
  cuenta_id: esquemaId.optional(),
});

export const parametrosDeNotificacion = z.object({ id: esquemaId });

const esquemaPlaca = z.object({
  dispositivo_id: z.string(),
  puerta_id: z.string(),
  puerta_nombre: z.string(),
  desde: z.string().nullable(),
  /** Solo en `apertura.fallida`. */
  fallos: z.number().int().optional(),
  causa: z.string().nullable().optional(),
});

/** El contenido de un aviso. Sin secretos: ni claves, ni tokens, ni MAC. */
const esquemaDatos = z.object({
  cuenta: z.object({ id: z.string(), codigo: z.string(), nombre: z.string() }),
  sitio: z.object({ id: z.string(), nombre: z.string() }).nullable(),
  placas: z.array(esquemaPlaca),
});

export const esquemaNotificacion = z.object({
  id: z.string(),
  tipo: esquemaTipo,
  severidad: z.enum(['info', 'aviso', 'critica']),
  cuenta_id: z.string(),
  cantidad: z.number().int(),
  resuelta: z.boolean(),
  leida: z.boolean(),
  datos: esquemaDatos,
  novedad_at: z.string(),
  resuelta_at: z.string().nullable(),
  leida_at: z.string().nullable(),
  creada_at: z.string(),
});

export const respuestaDeNotificaciones = esquemaListado(esquemaNotificacion);
export const respuestaDeContador = z.object({ no_leidas: z.number().int() });
export const respuestaDeMarcadas = z.object({ marcadas: z.number().int() });
