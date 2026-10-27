import { z } from 'zod';
import { esquemaListado, esquemaPaginacion } from '../../platform/http/paginacion.js';
import {
  ACCIONES_PROPUESTAS,
  TIPOS_DE_NOTIFICACION,
  TIPOS_DE_SENAL_DE_USO,
} from './domain/aviso.js';

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

/** Solo en `incidente.propuesta` (ADR 0033 §4.3). */
const esquemaPropuesta = z.object({
  accion: z.enum(ACCIONES_PROPUESTAS),
  usuario_id: z.string(),
  usuario_etiqueta: z.string().nullable(),
  incidente_id: z.string(),
  incidente_tipo: z.string(),
  confirmados: z.number().int(),
  minimo: z.number().int(),
  ventana_dias: z.number().int(),
  aplicada_automaticamente: z.boolean(),
});

/** Solo en `senal.uso` (ADR 0030 §4, ola W12). */
const esquemaSenal = z.object({
  tipo: z.enum(TIPOS_DE_SENAL_DE_USO),
  usuario_id: z.string(),
  usuario_etiqueta: z.string().nullable(),
  gravedad: z.enum(['baja', 'media', 'alta']),
  incidente_id: z.string().nullable(),
  dia: z.string(),
  valor: z.number().int(),
  umbral: z.number().int(),
});

/** Solo en `bolsa.aviso` y `bolsa.superada` (ADR 0030 §2 y §5, ola W12). */
const esquemaBolsa = z.object({
  mes: z.string(),
  dia: z.string(),
  usado: z.number().int().nullable(),
  tope: z.number().int().nullable(),
});

/** Solo en `flujo.atipico` (ADR 0030 §4, ola W12). */
const esquemaFlujo = z.object({
  dia: z.string(),
  aperturas: z.number().int(),
  usuarios_activos: z.number().int(),
  por_usuario: z.number(),
  umbral_por_usuario: z.number().int(),
  base: z.number().nullable(),
});

/** El contenido de un aviso. Sin secretos: ni claves, ni tokens, ni MAC. */
const esquemaDatos = z.object({
  cuenta: z.object({ id: z.string(), codigo: z.string(), nombre: z.string() }),
  sitio: z.object({ id: z.string(), nombre: z.string() }).nullable(),
  placas: z.array(esquemaPlaca),
  propuesta: esquemaPropuesta.optional(),
  senal: esquemaSenal.optional(),
  bolsa: esquemaBolsa.optional(),
  flujo: esquemaFlujo.optional(),
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
