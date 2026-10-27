import { z } from 'zod';
import { esquemaListado } from '../../platform/http/paginacion.js';
import { CAUSAS_DE_FALLA, EJECUCIONES } from './domain/confirmacion.js';
import { ESTADOS_DE_QR } from './domain/estado-qr.js';
import {
  FILAS_POR_PAGINA_MAXIMAS,
  FILAS_POR_PAGINA_POR_OMISION,
  RECURSOS_EXPORTABLES,
} from './domain/exportacion.js';
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
  /** Solo los eventos cuya orden de abrir terminó así (ADR 0031 §18); p. ej. `fallida` para ver las que fallan. */
  ejecucion: z.enum(EJECUCIONES).optional(),
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
  /**
   * Qué pasó con la orden de abrir (ADR 0031 §18). `null` en un rechazo y mientras la placa aún no informa.
   * `sin_confirmacion` = no se puede saber (puerta sin sensor, o la placa no contestó a tiempo; ver `causa` en el detalle).
   */
  ejecucion: z.enum(EJECUCIONES).nullable(),
  qr: z
    .object({
      id: z.string(),
      etiqueta: z.string().nullable(),
      generador: z.object({ id: z.string(), etiqueta: z.string().nullable() }),
    })
    .nullable(),
  /** Relecturas del mismo lector dentro de la ventana, enlazadas a este intento («×N»; ADR 0032 §4). */
  repeticiones: z.number().int(),
  repeticiones_permitidas: z.number().int(),
  repeticiones_rechazadas: z.number().int(),
});
export const respuestaListadoDeEventos = esquemaListado(esquemaEvento);

export const parametrosDeEvento = z.object({ id: esquemaId });

export const respuestaDeEventoDetallado = esquemaEvento.extend({
  confirmaciones: z.array(
    z.object({
      origen: z.enum(['placa', 'servidor']),
      resultado: z.enum(EJECUCIONES),
      causa: z.enum(['puerta_abrio', ...CAUSAS_DE_FALLA, 'sin_sensor', 'sin_respuesta']),
      registrada_at: esquemaFecha,
    }),
  ),
});

export const respuestaDeResumenDeEventos = z.object({
  permitidos: z.number().int(),
  rechazados: z.number().int(),
  rechazados_por_motivo: z.array(z.object({ motivo_code: z.string(), total: z.number().int() })),
  /** Aperturas repetidas por respuesta perdida (ADR 0032 §3): no suman a `permitidos`. */
  repeticiones_permitidas: z.number().int(),
  repeticiones_rechazadas: z.number().int(),
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

/**
 * Lo que la placa cuenta de una apertura que el servidor ordenó (ADR 0031 §18). `evento_id` es el que devolvió la
 * validación. `fallida` lleva su `causa` (si falta, se asume `puerta_no_abrio`); `ejecutada` y `sin_sensor` no
 * llevan causa. `leido_en` es la hora del reloj de la placa, solo informativa.
 */
export const cuerpoDeConfirmacionDeApertura = z.discriminatedUnion('resultado', [
  z.strictObject({
    evento_id: esquemaId,
    resultado: z.literal('ejecutada'),
    leido_en: z.string().max(40).optional(),
  }),
  z.strictObject({
    evento_id: esquemaId,
    resultado: z.literal('fallida'),
    causa: z.enum(CAUSAS_DE_FALLA).default('puerta_no_abrio'),
    leido_en: z.string().max(40).optional(),
  }),
  z.strictObject({
    evento_id: esquemaId,
    resultado: z.literal('sin_sensor'),
    leido_en: z.string().max(40).optional(),
  }),
]);

/** Por qué se anula en bloque: obligatorio y corto; entra a la bitácora (`anulaciones_masivas.motivo` es VARCHAR(200)). */
export const MAX_MOTIVO_DE_ANULACION = 200;

/**
 * Anulación masiva (ADR 0031 §3, ADR 0033 §3). `usuario_id` es el usuario (`alcance: usuario`) o la raíz de la rama
 * (`alcance: rama`); sin él, el propio actor. Con `alcance: cuenta` no se manda (422 si viene).
 */
export const cuerpoDeAnulacionMasiva = z
  .strictObject({
    alcance: z.enum(['usuario', 'rama', 'cuenta']),
    usuario_id: esquemaId.nullish(),
    motivo: z.string().trim().min(1).max(MAX_MOTIVO_DE_ANULACION),
  })
  .refine((cuerpo) => cuerpo.alcance !== 'cuenta' || cuerpo.usuario_id == null, {
    path: ['usuario_id'],
    message: 'usuario_id no va con el alcance cuenta',
  });

export const respuestaDeAnulacionMasiva = z.object({
  id: z.string(),
  alcance: z.enum(['usuario', 'rama', 'cuenta']),
  /** El usuario o la raíz de la rama; `null` con `alcance: cuenta`. */
  usuario_id: z.string().nullable(),
  usuarios_alcanzados: z.number().int(),
  /** Cuántos QR vigentes se anularon (0 si no había ninguno). */
  qr_anulados: z.number().int(),
});

export const parametrosDeExportacion = z.object({ recurso: z.enum(RECURSOS_EXPORTABLES) });

/** La cuenta del path de las rutas de plataforma (AGROCOM opera sobre ella). */
export const parametrosDeCuentaDePlataforma = z.object({ cuenta_id: esquemaId });

export const parametrosDeExportacionDeCuenta = parametrosDeExportacion.extend({
  cuenta_id: esquemaId,
});

/**
 * Anulación masiva de AGROCOM sobre una cuenta. Sin árbol que lo deduzca, `usuario` y `rama` exigen `usuario_id`
 * (el usuario o la raíz de la rama); `cuenta` es toda la cuenta y no lleva `usuario_id`.
 */
export const cuerpoDeAnulacionMasivaDePlataforma = z
  .strictObject({
    alcance: z.enum(['usuario', 'rama', 'cuenta']),
    usuario_id: esquemaId.nullish(),
    motivo: z.string().trim().min(1).max(MAX_MOTIVO_DE_ANULACION),
  })
  .refine((cuerpo) => cuerpo.alcance !== 'cuenta' || cuerpo.usuario_id == null, {
    path: ['usuario_id'],
    message: 'usuario_id no va con el alcance cuenta',
  })
  .refine((cuerpo) => cuerpo.alcance === 'cuenta' || cuerpo.usuario_id != null, {
    path: ['usuario_id'],
    message: 'usuario_id es obligatorio con el alcance usuario o rama',
  });

/**
 * Página de una exportación. Los filtros solo valen para `lecturas`; con otro recurso se ignoran.
 */
export const consultaDeExportacion = consultaDeEventos.extend({
  pagina: z.coerce.number().int().min(1).default(1),
  por_pagina: z.coerce
    .number()
    .int()
    .min(1)
    .max(FILAS_POR_PAGINA_MAXIMAS)
    .default(FILAS_POR_PAGINA_POR_OMISION),
});
