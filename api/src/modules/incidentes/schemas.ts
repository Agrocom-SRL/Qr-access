import { z } from 'zod';
import { esquemaListado, esquemaPaginacion } from '../../platform/http/paginacion.js';
import {
  ACCIONES_PROPUESTAS,
  GRAVEDADES,
  MAX_IDS_DE_EVIDENCIA,
  ORIGENES,
  RESULTADOS,
  TIPOS_DE_INCIDENTE,
} from './domain/incidente.js';

const esquemaId = z.string().regex(/^\d{1,19}$/);
const esquemaFecha = z.string();

export const MAX_DESCRIPCION = 300;
export const MAX_MOTIVO_DE_RESOLUCION = 200;

const esquemaTipo = z.enum(TIPOS_DE_INCIDENTE);
const esquemaGravedad = z.enum(GRAVEDADES);
const esquemaOrigen = z.enum(ORIGENES);
const esquemaResultado = z.enum(RESULTADOS);
const esquemaEstado = z.enum(['sin_resolver', ...RESULTADOS]);

export const consultaDeIncidentes = esquemaPaginacion.extend({
  usuario_id: esquemaId.optional(),
  tipo: esquemaTipo.optional(),
  origen: esquemaOrigen.optional(),
  /** `sin_resolver` = nadie lo ha resuelto todavía; los demás son el resultado de la última resolución. */
  estado: esquemaEstado.optional(),
});

export const parametrosDeIncidente = z.object({ id: esquemaId });
export const parametrosDeCuentaDeIncidentes = z.object({ cuenta_id: esquemaId });

/** Registro manual de un incidente. La evidencia son ids, nunca el texto ni el token de un QR. */
export const cuerpoDeIncidente = z.strictObject({
  usuario_id: esquemaId,
  tipo: esquemaTipo,
  gravedad: esquemaGravedad,
  descripcion: z
    .string()
    .trim()
    .max(MAX_DESCRIPCION)
    .transform((texto) => (texto === '' ? null : texto))
    .nullish(),
  /** Cuándo pasó (ISO 8601). Por omisión, ahora; no puede ser futuro. */
  ocurrido_at: z.iso
    .datetime({ offset: true })
    .transform((texto) => new Date(texto))
    .optional(),
  evidencia: z
    .strictObject({
      qr_ids: z.array(esquemaId).max(MAX_IDS_DE_EVIDENCIA).optional(),
      evento_acceso_ids: z.array(esquemaId).max(MAX_IDS_DE_EVIDENCIA).optional(),
    })
    .optional(),
});

/** Confirmar exige `motivo` (422 `incidente.motivo_requerido` si falta); descartar y dejar pendiente, no. */
export const cuerpoDeResolucion = z.strictObject({
  resultado: esquemaResultado,
  motivo: z.string().trim().max(MAX_MOTIVO_DE_RESOLUCION).nullish(),
});

const esquemaPersona = z.object({ id: z.string(), etiqueta: z.string().nullable() });

const esquemaResolucion = z.object({
  resultado: esquemaResultado,
  motivo: z.string().nullable(),
  resuelto_por: esquemaPersona,
  resuelta_at: esquemaFecha,
});

export const esquemaIncidente = z.object({
  id: z.string(),
  usuario: esquemaPersona,
  tipo: esquemaTipo,
  gravedad: esquemaGravedad,
  origen: esquemaOrigen,
  registrado_por: esquemaPersona.nullable(),
  descripcion: z.string().nullable(),
  /** Solo ids; nunca un token. */
  evidencia: z.object({
    qr_ids: z.array(z.string()),
    evento_acceso_ids: z.array(z.string()),
    evento_limite_ids: z.array(z.string()),
  }),
  estado: esquemaEstado,
  resolucion: esquemaResolucion.nullable(),
  ocurrido_at: esquemaFecha,
  created_at: esquemaFecha,
});

export const esquemaIncidenteDetallado = esquemaIncidente.extend({
  historial: z.array(esquemaResolucion),
});

export const respuestaListadoDeIncidentes = esquemaListado(esquemaIncidente);

export const respuestaDeResolucionDeIncidente = z.object({
  incidente: esquemaIncidenteDetallado,
  /** Solo al confirmar; `null` en los demás resultados o si repite el mismo resultado. */
  reincidencia: z
    .object({
      confirmados: z.number().int(),
      minimo: z.number().int(),
      ventana_dias: z.number().int(),
      /** El paso propuesto; `null` si no corresponde ninguno. */
      propuesta: z.enum(ACCIONES_PROPUESTAS).nullable(),
      aplicada_automaticamente: z.boolean(),
    })
    .nullable(),
});

export const respuestaDePolitica = z.object({
  reincidencia_minimo: z.number().int(),
  reincidencia_ventana_dias: z.number().int(),
  restriccion_automatica: z.boolean(),
});
